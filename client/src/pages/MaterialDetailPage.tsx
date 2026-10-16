import React, { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

type Listing = {
  id: number;
  title: string;
  description: string;
  category: string;
  material_name: string;
  quantity: number;
  minimum_order_quantity?: number | null;
  unit: string;
  price_per_unit: number;
  currency: string;
  seller_id: number;
  seller_name: string;
  origin_city?: string;
  origin_country?: string;
};
type Match = {
  requirement_id: number;
  buyer_name: string;
  required_quantity: number;
  required_unit: string;
  available_quantity: number;
  available_unit: string;
  quantity_sufficient: boolean;
  distance_km: number | null;
  distance_allowed: boolean;
  is_feasible: boolean;
  transport_cost: number | null;
  revenue: number;
  processing_cost: number;
  avoided_disposal_cost: number | null;
  net_benefit: number | null;
  waste_diverted_kg: number | null;
  co2_saved_kg: number | null;
  assumptions: string[];
};

const Page = styled.main`max-width:1000px;margin:0 auto;padding:2rem;`;
const Panel = styled.section`padding:1.5rem;margin:1rem 0;border:1px solid #dde5e1;border-radius:12px;background:${({ theme }) => theme.colors.background.paper};`;
const Button = styled.button`padding:.7rem 1rem;border:0;border-radius:7px;background:${({ theme }) => theme.colors.primary.main};color:white;cursor:pointer;&:disabled{opacity:.6}`;
const Input = styled.input`display:block;max-width:260px;padding:.7rem;margin:.5rem 0 1rem;border:1px solid #ccd5d1;border-radius:7px;`;
const Grid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.75rem;`;

const MaterialDetailPage: React.FC = () => {
  const { id } = useParams();
  const { isLoggedIn, user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [requestQuantity, setRequestQuantity] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isOwner = Boolean(listing && Number(user?.id) === Number(listing.seller_id));

  useEffect(() => {
    api.get(`/api/listings/${id}`).then(({ data }) => {
      setListing(data);
      setRequestQuantity(String(data.minimum_order_quantity || 1));
    }).catch((e) => setError(e.response?.data?.message || 'Listing could not be loaded.'));
  }, [id]);

  const findMatches = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.get(`/api/matches/${id}`);
      setMatches(data.matches);
      setLoaded(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not calculate compatible buyers.');
    } finally {
      setBusy(false);
    }
  };

  const requestExchange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!listing) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/api/transactions', { listing_id: listing.id, quantity: Number(requestQuantity) });
      window.alert('Request sent. The listing owner can accept or decline it in Exchange requests.');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  if (error && !listing) return <Page><p role="alert">{error}</p><Link to="/marketplace">Back to marketplace</Link></Page>;
  if (!listing) return <Page><p>Loading listing…</p></Page>;

  return (
    <Page>
      <Link to="/marketplace">← Marketplace</Link>
      <Panel>
        <small>{listing.category}</small>
        <h1>{listing.title}</h1>
        <p>{listing.description}</p>
        <p><strong>Material:</strong> {listing.material_name} · <strong>Available:</strong> {listing.quantity} {listing.unit}</p>
        <p><strong>Price:</strong> {listing.price_per_unit} {listing.currency}/{listing.unit}</p>
        <p><strong>Supplier:</strong> {listing.seller_name} · {[listing.origin_city, listing.origin_country].filter(Boolean).join(', ') || 'Location not provided'}</p>
      </Panel>

      {isLoggedIn && !isOwner && (
        <Panel>
          <h2>Request this material</h2>
          <p>Choose a quantity and send a request directly to the listing owner. They decide whether to accept it.</p>
          <form onSubmit={requestExchange}>
            <label htmlFor="request-quantity">Quantity ({listing.unit})</label>
            <Input id="request-quantity" type="number" min={listing.minimum_order_quantity || 0.01} max={listing.quantity} step="any" required value={requestQuantity} onChange={(event) => setRequestQuantity(event.target.value)} />
            <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send exchange request'}</Button>
          </form>
          {error && <p role="alert">{error}</p>}
        </Panel>
      )}
      {!isLoggedIn && <Panel><p><Link to="/login">Sign in</Link> to request this material.</p></Panel>}

      {isOwner && (
        <Panel>
          <h2>Compatibility and feasibility</h2>
          <p>Compatible buyers are ranked by straight-line distance, nearest first. Distance and impact figures are estimates.</p>
          <Button onClick={findMatches} disabled={busy}>{busy ? 'Checking…' : 'Find compatible buyers'}</Button>
          {error && <p role="alert">{error}</p>}
          {loaded && !matches.length && <p>No active buyer requirements match this material and its quality properties.</p>}
          {matches.map((match, index) => (
            <Panel key={match.requirement_id}>
              <h3>{match.buyer_name}</h3>
              <p><strong>Distance rank:</strong> {index + 1}{match.distance_km === null ? ' · distance unavailable' : ` · ${match.distance_km} km`}</p>
              <p>Required: {match.required_quantity} {match.required_unit} · Available: {match.available_quantity} {match.available_unit}</p>
              <p>{match.quantity_sufficient ? 'Quantity available' : 'Supply shortage'} · {match.distance_km === null ? 'Distance unavailable: add coordinates' : `${match.distance_km} km straight-line`} · {match.distance_allowed ? 'Within distance limit' : 'Over buyer distance limit'}</p>
              <Grid>
                <div><strong>Logistics</strong><p>Transport estimate: {match.transport_cost === null ? 'Unavailable' : `${match.transport_cost} ${listing.currency}`}</p></div>
                <div><strong>Economic estimate</strong><p>Revenue: {match.revenue} {listing.currency}</p><p>Avoided disposal: {match.avoided_disposal_cost === null ? 'Unavailable' : `${match.avoided_disposal_cost} ${listing.currency}`}</p><p>Processing: {match.processing_cost} {listing.currency}</p><p>Net benefit: {match.net_benefit === null ? 'Unavailable' : `${match.net_benefit} ${listing.currency}`}</p></div>
                <div><strong>Environmental estimate</strong><p>Waste diverted: {match.waste_diverted_kg === null ? 'Unavailable' : `${match.waste_diverted_kg} kg`}</p><p>Potential CO₂e savings: {match.co2_saved_kg === null ? 'Unavailable' : `${match.co2_saved_kg} kg`}</p></div>
              </Grid>
              <details><summary>Calculation assumptions</summary><ul>{match.assumptions.map((item) => <li key={item}>{item}</li>)}</ul></details>
            </Panel>
          ))}
        </Panel>
      )}
    </Page>
  );
};

export default MaterialDetailPage;
