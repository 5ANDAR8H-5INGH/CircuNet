import React, { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import api from '../utils/api';

type ListingProperty = { name: string; value: string; unit?: string | null };
type ListingForm = {
  title: string;
  description: string;
  category: string;
  material_name: string;
  physical_form: string;
  quantity: number | string;
  unit: string;
  price_per_unit: number | string;
  currency: string;
  origin_city: string;
  origin_country: string;
  origin_latitude: number | string | null;
  origin_longitude: number | string | null;
  available_from: string;
  available_until: string;
  quality_certification: string;
  properties: ListingProperty[];
};

const Page = styled.main`max-width:900px;margin:0 auto;padding:2rem;`;
const Form = styled.form`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;padding:1.5rem;border:1px solid #dde5e1;border-radius:12px;background:${({ theme }) => theme.colors.background.paper};`;
const Field = styled.label`display:flex;flex-direction:column;gap:.4rem;`;
const Input = styled.input`padding:.7rem;border:1px solid #ccd5d1;border-radius:7px;`;
const Select = styled.select`padding:.7rem;border:1px solid #ccd5d1;border-radius:7px;`;
const Wide = styled.div`grid-column:1/-1;`;
const Button = styled.button`padding:.7rem 1rem;border:0;border-radius:7px;background:${({ theme }) => theme.colors.primary.main};color:white;cursor:pointer;&:disabled{opacity:.6}`;

const dateValue = (value: unknown) => value ? String(value).slice(0, 10) : '';

const EditListingPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ListingForm | null>(null);

  useEffect(() => {
    api.get(`/api/listings/${id}`).then(({ data: listing }) => setData({
      title: listing.title || '', description: listing.description || '', category: listing.category || '',
      material_name: listing.material_name || '', physical_form: listing.physical_form || 'solid',
      quantity: listing.quantity, unit: listing.unit || 'kg', price_per_unit: listing.price_per_unit ?? 0,
      currency: listing.currency || 'USD', origin_city: listing.origin_city || '', origin_country: listing.origin_country || '',
      origin_latitude: listing.origin_latitude ?? '', origin_longitude: listing.origin_longitude ?? '',
      available_from: dateValue(listing.available_from), available_until: dateValue(listing.available_until),
      quality_certification: listing.quality_certification || '', properties: listing.properties || [],
    })).catch((e) => setError(e.response?.data?.message || 'Could not load listing.'));
  }, [id]);

  const change = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setData((current) => current ? { ...current, [name]: value } : current);
  };

  const changeProperty = (index: number, key: keyof ListingProperty, value: string) => {
    setData((current) => current ? {
      ...current,
      properties: current.properties.map((property, propertyIndex) => propertyIndex === index ? { ...property, [key]: value } : property),
    } : current);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError('');
    const payload = {
      title: data.title.trim(), description: data.description, category: data.category,
      material_name: data.material_name.trim(), physical_form: data.physical_form,
      quantity: Number(data.quantity), unit: data.unit, price_per_unit: Number(data.price_per_unit), currency: data.currency.toUpperCase(),
      origin_city: data.origin_city, origin_country: data.origin_country,
      origin_latitude: data.origin_latitude === '' ? null : Number(data.origin_latitude),
      origin_longitude: data.origin_longitude === '' ? null : Number(data.origin_longitude),
      available_from: data.available_from, available_until: data.available_until || null,
      quality_certification: data.quality_certification,
      properties: data.properties.filter((property) => property.name.trim() && property.value.trim()).map((property) => ({
        name: property.name.trim(), value: property.value.trim(), unit: property.unit || '',
      })),
    };
    try {
      await api.put(`/api/listings/${id}`, payload);
      navigate('/my-listings', { state: { message: 'Listing updated successfully.' } });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not update listing.');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Page><h1>Edit listing</h1><p role={error ? 'alert' : undefined}>{error || 'Loading listing…'}</p><Link to="/my-listings">Back to my listings</Link></Page>;

  return (
    <Page>
      <h1>Edit listing</h1>
      <p>Update the material details buyers see in the marketplace.</p>
      {error && <p role="alert">{error}</p>}
      <Form onSubmit={submit}>
        <Field>Title<Input name="title" value={data.title} onChange={change} required minLength={3} maxLength={255} /></Field>
        <Field>Category<Select name="category" value={data.category} onChange={change} required>{['Plastics', 'Metals', 'Paper & Pulp', 'Textiles', 'Glass', 'Organics', 'Construction', 'Electronics'].map((category) => <option key={category}>{category}</option>)}</Select></Field>
        <Field>Material name<Input name="material_name" value={data.material_name} onChange={change} required /></Field>
        <Field>Physical form<Select name="physical_form" value={data.physical_form} onChange={change}><option value="solid">Solid</option><option value="liquid">Liquid</option><option value="gas">Gas</option><option value="mixed">Mixed</option></Select></Field>
        <Field>Available quantity<Input type="number" min="0.01" step="any" name="quantity" value={data.quantity} onChange={change} required /></Field>
        <Field>Unit<Input name="unit" value={data.unit} onChange={change} required /></Field>
        <Field>Price per unit<Input type="number" min="0" step="any" name="price_per_unit" value={data.price_per_unit} onChange={change} required /></Field>
        <Field>Currency (3 letters)<Input name="currency" value={data.currency} onChange={change} required minLength={3} maxLength={3} /></Field>
        <Field>City<Input name="origin_city" value={data.origin_city} onChange={change} /></Field>
        <Field>Country<Input name="origin_country" value={data.origin_country} onChange={change} /></Field>
        <Field>Latitude<Input type="number" min="-90" max="90" step="any" name="origin_latitude" value={data.origin_latitude ?? ''} onChange={change} /></Field>
        <Field>Longitude<Input type="number" min="-180" max="180" step="any" name="origin_longitude" value={data.origin_longitude ?? ''} onChange={change} /></Field>
        <Field>Available from<Input type="date" name="available_from" value={data.available_from} onChange={change} required /></Field>
        <Field>Available until<Input type="date" name="available_until" value={data.available_until} onChange={change} /></Field>
        <Field>Certification<Input name="quality_certification" value={data.quality_certification} onChange={change} /></Field>
        <Wide><label htmlFor="description">Description</label><Input id="description" name="description" value={data.description} onChange={change} /></Wide>
        <Wide><h2>Quality properties</h2>{data.properties.map((property, index) => <div key={`${index}-${property.name}`} style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.5rem' }}><Input aria-label="Property name" placeholder="Property name" value={property.name} onChange={(event) => changeProperty(index, 'name', event.target.value)} /><Input aria-label="Property value" placeholder="Property value" value={property.value} onChange={(event) => changeProperty(index, 'value', event.target.value)} /><Input aria-label="Property unit" placeholder="Unit" value={property.unit || ''} onChange={(event) => changeProperty(index, 'unit', event.target.value)} /></div>)}<Button type="button" onClick={() => setData((current) => current ? { ...current, properties: [...current.properties, { name: '', value: '', unit: '' }] } : current)}>Add property</Button></Wide>
        <Wide><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button> <Link to="/my-listings">Cancel</Link></Wide>
      </Form>
    </Page>
  );
};

export default EditListingPage;
