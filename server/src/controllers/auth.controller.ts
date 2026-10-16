import { Request, Response } from 'express';
import { UserLoginInput, UserRegistrationInput, UserRole, CompanyType } from '../interfaces/user.interface';
import Joi from 'joi';
import pool from '../config/database';
import { hashPassword, comparePassword } from '../utils/password.utils';
import { generateToken } from '../utils/jwt.utils';

// Validation schema for user registration
const registrationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  company_name: Joi.string().required(),
  role: Joi.string().valid('company', 'transporter').required(),
  contact_person: Joi.string().optional(),
  phone: Joi.string().optional(),
  address: Joi.string().optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  country: Joi.string().optional(),
  postal_code: Joi.string().optional(),
  company_type: Joi.string().valid('manufacturer', 'recycler', 'processor', 'distributor').when('role', {
    is: 'company',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  industry_sector: Joi.string().optional()
});

// Validation schema for user login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response) => {
  try {
    const input = {
      email: req.body.email,
      password: req.body.password,
      company_name: req.body.company_name || req.body.companyName,
      role: req.body.role || 'company',
      company_type: req.body.company_type || req.body.companyType || 'manufacturer',
      contact_person: req.body.contact_person || req.body.name,
      industry_sector: req.body.industry_sector || req.body.industrySector,
      city: req.body.city,
      country: req.body.country,
    };
    const { error } = registrationSchema.validate(input);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const passwordHash = await hashPassword(input.password);
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      result = await client.query(
        `INSERT INTO users (email, password_hash, role, company_name, contact_person, city, country)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING user_id, email, role, company_name, contact_person`,
        [input.email.toLowerCase(), passwordHash, input.role, input.company_name, input.contact_person, input.city || null, input.country || null]
      );
      if (input.role === 'company') {
        await client.query(
          `INSERT INTO company_profiles (user_id, company_type, industry_sector) VALUES ($1, $2, $3)`,
          [result.rows[0].user_id, input.company_type, input.industry_sector || null]
        );
      }
      await client.query('COMMIT');
    } catch (dbError: any) {
      await client.query('ROLLBACK');
      if (dbError.code === '23505') return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      throw dbError;
    } finally {
      client.release();
    }
    const row = result.rows[0];
    const userData = { id: row.user_id, name: row.company_name, email: row.email, role: row.role, companyName: row.company_name };
    const token = generateToken({
      id: userData.id,
      email: userData.email,
      role: userData.role
    });
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: userData,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * Login user and return JWT token
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT user_id, email, password_hash, role, company_name FROM users WHERE email = $1 AND active = TRUE`,
      [email.toLowerCase()]
    );
    if (!result.rowCount || !(await comparePassword(password, result.rows[0].password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    const row = result.rows[0];
    const token = generateToken({ id: row.user_id, email: row.email, role: row.role });
    res.status(200).json({
      success: true,
      token,
      user: { id: row.user_id, name: row.company_name, companyName: row.company_name, email: row.email, role: row.role }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/** Restore the current account from a valid access token. */
export const currentUser = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT user_id, email, role, company_name FROM users WHERE user_id=$1 AND active=TRUE`,
      [req.user?.id]
    );
    if (!result.rowCount) return res.status(401).json({ success: false, message: 'The account is no longer active.' });
    const row = result.rows[0];
    return res.json({
      success: true,
      user: { id: row.user_id, name: row.company_name, companyName: row.company_name, email: row.email, role: row.role, avatar: '' },
    });
  } catch (error) {
    console.error('Current user lookup error:', error);
    return res.status(500).json({ success: false, message: 'Unable to restore the current account.' });
  }
};
