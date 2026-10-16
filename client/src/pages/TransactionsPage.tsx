import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

type Exchange={transaction_id:number;listing_id:number;buyer_id:number;seller_id:number;requested_by:number|null;buyer_name:string;seller_name:string;listing_title:string;listing_unit:string;material_name:string;quantity:number;unit_price:number;currency:string;total_price:number;status:string;logistics_distance_km:number|null;transport_cost:number|null;net_benefit:number|null;waste_diverted_kg:number|null;co2_saved_kg:number|null;notes:string};
const Page=styled.main`max-width:1100px;margin:0 auto;padding:2rem;`;
const Card=styled.article`padding:1.25rem;margin:1rem 0;border:1px solid #dce5e0;border-radius:10px;`;
const Button=styled.button`padding:.65rem .9rem;margin-right:.6rem;border:0;border-radius:7px;background:${({theme})=>theme.colors.primary.main};color:white;cursor:pointer;`;
const TransactionsPage:React.FC=()=>{
  const {user}=useAuth();const [items,setItems]=useState<Exchange[]>([]);const [error,setError]=useState('');
  const load=()=>api.get('/api/transactions').then(({data})=>setItems(data)).catch((e)=>setError(e.response?.data?.message||'Could not load exchange requests.'));
  useEffect(()=>{load()},[]);
  const change=async(id:number,status:'approved'|'cancelled')=>{try{await api.patch(`/api/transactions/${id}/status`,{status});await load()}catch(e:any){setError(e.response?.data?.message||'Could not update request.')}};
  return <Page><h1>Exchange requests</h1><p>Review requests sent to or received by your company. The listing owner decides whether to accept each request.</p>{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p>No exchange requests yet.</p>}{items.map((item)=><Card key={item.transaction_id}><h2>{item.listing_title||item.material_name||'Material exchange'}</h2><p>{item.requested_by===user?.id?'Sent by your company':'Received by your company'} · {item.buyer_name} ↔ {item.seller_name}</p><p>{item.quantity} {item.listing_unit} · {item.total_price} {item.currency} · Status: <strong>{item.status}</strong></p><p><strong>Logistics:</strong> {item.logistics_distance_km===null?'Unavailable':`${item.logistics_distance_km} km straight-line`} · transport {item.transport_cost===null?'unavailable':`${item.transport_cost} ${item.currency}`}</p><p><strong>Economic estimate:</strong> net benefit {item.net_benefit===null?'unavailable':`${item.net_benefit} ${item.currency}`}</p><p><strong>Environmental estimate:</strong> {item.waste_diverted_kg===null?'unavailable':`${item.waste_diverted_kg} kg diverted`} · {item.co2_saved_kg===null?'CO₂e estimate unavailable':`${item.co2_saved_kg} kg potential CO₂e savings`}</p>{item.notes&&<details><summary>Request details</summary><p>{item.notes}</p><p>Any estimates shown are not verified real-world savings.</p></details>}{item.status==='pending'&&<div>{item.seller_id===user?.id&&item.requested_by!==user?.id&&<Button onClick={()=>change(item.transaction_id,'approved')}>Accept request</Button>}<Button onClick={()=>change(item.transaction_id,'cancelled')}>{item.seller_id===user?.id&&item.requested_by!==user?.id?'Decline request':'Cancel request'}</Button></div>}</Card>)}</Page>;
};
export default TransactionsPage;
