import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import api from '../utils/api';

type Listing={id:number;title:string;description:string;category:string;material_name:string;quantity:number;unit:string;price_per_unit:number;currency:string;origin_city?:string;origin_country?:string;is_active:boolean};
const Page=styled.main`max-width:1100px;margin:0 auto;padding:2rem;`;
const Card=styled.article`padding:1.25rem;margin:1rem 0;border:1px solid #dce5e0;border-radius:10px;`;
const Button=styled.button`padding:.6rem .9rem;margin-right:.6rem;border:0;border-radius:7px;background:${({theme})=>theme.colors.primary.main};color:white;cursor:pointer;`;
const MyListingsPage:React.FC=()=>{
  const [items,setItems]=useState<Listing[]>([]);const [error,setError]=useState('');
  const load=()=>api.get('/api/listings/mine').then(({data})=>setItems(data)).catch((e)=>setError(e.response?.data?.message||'Could not load your listings.'));
  useEffect(()=>{load()},[]);
  const close=async(id:number)=>{try{await api.delete(`/api/listings/${id}`);await load()}catch(e:any){setError(e.response?.data?.message||'Could not close listing.')}};
  return <Page><h1>My listings</h1><p>Listings published by your company.</p><Link to="/create-listing">Create listing</Link>{error&&<p role="alert">{error}</p>}{!items.length&&!error&&<p>You have not published any listings yet.</p>}{items.map((item)=><Card key={item.id}><h2>{item.title}</h2><p>{item.category} · {item.material_name}</p><p>{item.quantity} {item.unit} · {item.price_per_unit} {item.currency}/{item.unit}</p><p>{item.description}</p><p>Status: {item.is_active?'Active':'Closed'}</p>{item.is_active&&<><Button onClick={()=>close(item.id)}>Close listing</Button> <Link to={`/edit-listing/${item.id}`}>Edit listing</Link></>}<p><Link to={`/marketplace/${item.id}`}>View listing</Link></p></Card>)}</Page>;
};
export default MyListingsPage;
