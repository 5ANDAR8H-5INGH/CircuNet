import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

type Listing={id:number;is_active:boolean};
type Exchange={status:string;waste_diverted_kg:number|null;co2_saved_kg:number|null;total_price:number;currency:string};
const Page=styled.main`max-width:1100px;margin:0 auto;padding:2rem;`;
const Grid=styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1.5rem 0;`;
const Card=styled.article`padding:1.3rem;border:1px solid #dce5e0;border-radius:12px;`;
const Action=styled(Link)`display:inline-block;margin:.3rem .7rem .3rem 0;padding:.7rem 1rem;background:${({theme})=>theme.colors.primary.main};color:white;border-radius:7px;text-decoration:none;`;
const DashboardPage:React.FC=()=>{
  const {user}=useAuth();const [listings,setListings]=useState<Listing[]>([]);const [exchanges,setExchanges]=useState<Exchange[]>([]);const [error,setError]=useState('');
  useEffect(()=>{Promise.all([api.get('/api/listings/mine'),api.get('/api/transactions')]).then(([a,b])=>{setListings(a.data);setExchanges(b.data)}).catch((e)=>setError(e.response?.data?.message||'Could not load company overview.'))},[]);
  const pending=exchanges.filter((x)=>x.status==='pending').length;
  const activeExchanges=exchanges.filter((x)=>x.status!=='cancelled');
  const totalWaste=activeExchanges.reduce((s,x)=>s+Number(x.waste_diverted_kg||0),0);
  const co2Estimates=activeExchanges.filter((exchange)=>exchange.co2_saved_kg!==null&&exchange.co2_saved_kg!==undefined);
  const totalCo2=co2Estimates.reduce((s,x)=>s+Number(x.co2_saved_kg),0);
  const co2Display=activeExchanges.length>0&&co2Estimates.length===0?'Unavailable':`${totalCo2.toFixed(1)} kg`;
  return <Page><h1>Company overview</h1><p>Welcome back, {user?.name||'Company'}.</p>{error&&<p role="alert">{error}</p>}<Grid><Card><strong>Active listings</strong><h2>{listings.filter((x)=>x.is_active).length}</h2></Card><Card><strong>Exchange requests</strong><h2>{exchanges.length}</h2></Card><Card><strong>Pending decisions</strong><h2>{pending}</h2></Card><Card><strong>Estimated waste diverted</strong><h2>{totalWaste.toFixed(1)} kg</h2></Card><Card><strong>Potential CO₂e savings</strong><h2>{co2Display}</h2>{co2Estimates.length>0&&<small>{co2Estimates.length} request estimate{co2Estimates.length===1?'':'s'}</small>}</Card></Grid><p>Environmental totals are estimates from non-cancelled exchange requests and may include pending requests. CO₂e requires listing and buyer coordinates plus configured emission factors. Values are not verified savings.</p><Action to="/create-listing">Create a listing</Action><Action to="/requirements">Manage buyer requirements</Action><Action to="/marketplace">Browse materials</Action><Action to="/transactions">Review exchanges</Action></Page>;
};
export default DashboardPage;
