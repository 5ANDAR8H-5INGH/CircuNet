import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import api from '../utils/api';

type Listing = { id: number; title: string; description: string; category: string; material_name: string; quantity: number; unit: string; price_per_unit: number; currency: string; origin_city?: string; origin_country?: string; seller_name: string };
const Page = styled.main`max-width:1280px;margin:0 auto;padding:3rem 2rem 4rem;@media(max-width:600px){padding:2rem 1rem 3rem;}`;
const Header = styled.div`display:flex;justify-content:space-between;align-items:center;gap:1.25rem;flex-wrap:wrap;margin-bottom:2rem;padding:2rem;border:1px solid ${({theme})=>theme.colors.border};border-radius:20px;background:linear-gradient(135deg,#fff 0%,#edf5ef 100%);h1{margin:0 0 .45rem;color:${({theme})=>theme.colors.primary.dark};font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.035em}p{margin:0;color:${({theme})=>theme.colors.text.secondary};}`;
const Grid = styled.div`display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1.25rem;`;
const Card = styled.article`padding:1.5rem;border:1px solid ${({theme})=>theme.colors.border};border-radius:16px;background:${({theme})=>theme.colors.background.paper};box-shadow:${({theme})=>theme.shadows.sm};transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease;&:hover{transform:translateY(-3px);box-shadow:${({theme})=>theme.shadows.md};border-color:#b8cec0}small{display:inline-block;color:${({theme})=>theme.colors.primary.main};font-weight:700;letter-spacing:.07em;text-transform:uppercase}h2{margin:.65rem 0;color:${({theme})=>theme.colors.text.primary};font-size:1.25rem}p{color:${({theme})=>theme.colors.text.secondary};line-height:1.6}strong{color:${({theme})=>theme.colors.text.primary}}`;
const Button = styled(Link)`display:inline-flex;align-items:center;justify-content:center;margin-top:1rem;padding:.75rem 1.05rem;background:${({theme})=>theme.colors.primary.main};color:white;border-radius:10px;text-decoration:none;font-weight:600;transition:background .18s ease,transform .18s ease;&:hover{background:${({theme})=>theme.colors.primary.dark};color:white;transform:translateY(-1px)}`;
const Search = styled.input`padding:.8rem 1rem;border:1px solid ${({theme})=>theme.colors.border};border-radius:10px;min-width:240px;background:#fff;color:${({theme})=>theme.colors.text.primary};font:inherit;outline:none;&:focus{border-color:${({theme})=>theme.colors.primary.main};box-shadow:0 0 0 3px rgba(23,107,77,.12)}`;
const MarketplacePage: React.FC = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.get('/api/listings').then(({data}) => setListings(data)).catch(() => setError('Could not load listings. Check that the API and database are running.')); }, []);
  const filtered = useMemo(() => listings.filter((item) => `${item.title} ${item.material_name} ${item.category} ${item.origin_city || ''}`.toLowerCase().includes(query.toLowerCase())), [listings, query]);
  return <Page>
    <Header><div><h1>By-product marketplace</h1><p>Browse active industrial materials and explore potential exchanges.</p></div><Search aria-label="Search listings" placeholder="Search by material or location" value={query} onChange={(e) => setQuery(e.target.value)} /><Button to="/requirements">Manage buyer requirements</Button></Header>
    {error && <p role="alert">{error}</p>}
    {!error && !filtered.length && <p>{listings.length ? 'No listings match your search.' : 'No active listings yet.'}</p>}
    <Grid>{filtered.map((listing) => <Card key={listing.id}><small>{listing.category}</small><h2>{listing.title}</h2><p>{listing.description || 'No description provided.'}</p><p><strong>Material:</strong> {listing.material_name}</p><p><strong>Available:</strong> {listing.quantity} {listing.unit}</p><p><strong>Price:</strong> {listing.price_per_unit} {listing.currency}/{listing.unit}</p><p><strong>Supplier:</strong> {listing.seller_name}</p><p><strong>Location:</strong> {[listing.origin_city, listing.origin_country].filter(Boolean).join(', ') || 'Not provided'}</p><Button to={`/marketplace/${listing.id}`}>View compatibility</Button></Card>)}</Grid>
  </Page>;
};
export default MarketplacePage;
