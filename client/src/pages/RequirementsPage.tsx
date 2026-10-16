import React, { FormEvent, useEffect, useState } from 'react';
import styled from 'styled-components';
import api from '../utils/api';

const Page = styled.main`max-width:960px;margin:0 auto;padding:2rem;`;
const Form = styled.form`display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem;padding:1.5rem;background:${({theme})=>theme.colors.background.paper};border-radius:12px;box-shadow:${({theme})=>theme.shadows.md};`;
const Field = styled.label`display:flex;flex-direction:column;gap:.4rem;font-size:.9rem;`;
const Input = styled.input`padding:.7rem;border:1px solid #ccd5d1;border-radius:7px;`;
const Select = styled.select`padding:.7rem;border:1px solid #ccd5d1;border-radius:7px;`;
const Button = styled.button<{ $secondary?:boolean; $compact?:boolean }>`padding:${({$compact})=>$compact?'.45rem .7rem':'.65rem .9rem'};font-size:${({$compact})=>$compact?'.88rem':'1rem'};background:${({theme,$secondary})=>$secondary?theme.colors.background.paper:theme.colors.primary.main};color:${({theme,$secondary})=>$secondary?theme.colors.primary.main:'#fff'};border:${({theme,$secondary})=>$secondary?`1px solid ${theme.colors.primary.main}`:'1px solid transparent'};border-radius:7px;cursor:pointer;`;
const Actions = styled.div`display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem;`;
const Item = styled.article`padding:1rem;margin:1rem 0;border:1px solid #dde5e1;border-radius:10px;`;
type Requirement = { requirement_id:number; material_category:string; material_name?:string; minimum_quantity:number; unit:string; city?:string; country?:string; latitude?:number|null; longitude?:number|null; max_distance_km?:number|null; processing_cost?:number; properties?:{name:string;minimum?:number|null;maximum?:number|null;unit?:string|null}[] };
const categories = ['Plastics','Metals','Paper & Pulp','Textiles','Glass','Organics','Construction','Electronics'];
const RequirementsPage: React.FC = () => {
  const [items,setItems] = useState<Requirement[]>([]);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [editing,setEditing] = useState<Requirement|null>(null);
  const load = () => api.get('/api/requirements').then(({data})=>setItems(data)).catch((e)=>setError(e.response?.data?.message || 'Could not load requirements.'));
  useEffect(()=>{ load(); },[]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const min = String(form.get('property_min') || '').trim(); const max = String(form.get('property_max') || '').trim();
    const name = String(form.get('property_name') || '').trim();
    const properties: {name:string; minimum:number|null; maximum:number|null; unit:string}[] = name && (min || max)
      ? [{name, minimum:min ? Number(min) : null, maximum:max ? Number(max) : null, unit:String(form.get('property_unit') || '')}]
      : [];
    if (editing?.properties?.length) {
      properties.push(...editing.properties.slice(1).map((property)=>({
        name:property.name, minimum:property.minimum ?? null, maximum:property.maximum ?? null, unit:property.unit || ''
      })));
    }
    try {
      const payload = {
        material_category:form.get('material_category'), material_name:String(form.get('material_name') || '').trim() || null,
        minimum_quantity:Number(form.get('minimum_quantity')), unit:form.get('unit'), city:form.get('city') || null, country:form.get('country') || null,
        latitude:form.get('latitude') ? Number(form.get('latitude')) : null, longitude:form.get('longitude') ? Number(form.get('longitude')) : null,
        max_distance_km:form.get('max_distance_km') ? Number(form.get('max_distance_km')) : null,
        processing_cost:Number(form.get('processing_cost') || 0), properties
      };
      if (editing) await api.put(`/api/requirements/${editing.requirement_id}`, payload);
      else await api.post('/api/requirements', payload);
      formElement.reset(); setEditing(null); await load();
    } catch(e:any) { setError(e.response?.data?.message || 'Could not save requirement.'); }
    finally { setBusy(false); }
  };
  const close = async (id:number) => { setError(''); try { await api.delete(`/api/requirements/${id}`); setItems((current)=>current.filter((item)=>item.requirement_id!==id)); } catch(e:any) { setError(e.response?.data?.message || 'Could not close requirement.'); } };
  const startEditing = (item:Requirement) => { setError(''); setEditing(item); window.scrollTo({top:0,behavior:'smooth'}); };
  const firstProperty = editing?.properties?.[0];
  return <Page><h1>Buyer requirements</h1><p>Define the materials and minimum quantities your company can use. Optional quality ranges filter out incompatible listings.</p>
    {error && <p role="alert">{error}</p>}
    <Form key={editing?.requirement_id ?? 'new-requirement'} onSubmit={submit}>
      {editing&&<h2>{`Edit requirement ${editing.requirement_id}`}</h2>}
      <Field>Material category<Select name="material_category" required defaultValue={editing?.material_category || categories[0]}>{categories.map((c)=><option key={c}>{c}</option>)}</Select></Field>
      <Field>Material or subcategory (optional)<Input name="material_name" defaultValue={editing?.material_name || ''} placeholder="For example, HDPE" /></Field>
      <Field>Minimum quantity<Input name="minimum_quantity" type="number" min="0.01" step="any" defaultValue={editing?.minimum_quantity ?? ''} required /></Field>
      <Field>Unit<Select name="unit" defaultValue={editing?.unit || 'kg'}><option value="kg">kg</option><option value="ton">tonne</option><option value="lb">lb</option><option value="piece">piece</option></Select></Field>
      <Field>Buyer city<Input name="city" defaultValue={editing?.city || ''} /></Field><Field>Buyer country<Input name="country" defaultValue={editing?.country || ''} /></Field>
      <Field>Latitude (optional)<Input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={editing?.latitude ?? ''} /></Field><Field>Longitude (optional)<Input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={editing?.longitude ?? ''} /></Field>
      <Field>Maximum distance in km<Input name="max_distance_km" type="number" min="1" step="any" defaultValue={editing?.max_distance_km ?? ''} /></Field><Field>Processing cost per exchange<Input name="processing_cost" type="number" min="0" step="any" defaultValue={editing?.processing_cost ?? 0} /></Field>
      <Field>Quality property<Input name="property_name" defaultValue={firstProperty?.name || ''} placeholder="For example, purity" /></Field><Field>Minimum value<Input name="property_min" type="number" step="any" defaultValue={firstProperty?.minimum ?? ''} /></Field><Field>Maximum value<Input name="property_max" type="number" step="any" defaultValue={firstProperty?.maximum ?? ''} /></Field><Field>Property unit<Input name="property_unit" defaultValue={firstProperty?.unit || ''} placeholder="%" /></Field>
      <Actions><Button type="submit" disabled={busy}>{busy?'Saving…':editing?'Save changes':'Save requirement'}</Button>{editing&&<Button $secondary type="button" onClick={()=>setEditing(null)}>Cancel editing</Button>}</Actions>
    </Form>
    <h2>Your active requirements</h2>
    {!items.length && <p>No active requirements yet.</p>}
    {items.map((item)=><Item key={item.requirement_id}><h3>{item.material_category}: {item.material_name || 'Any compatible material'}</h3><p>At least {item.minimum_quantity} {item.unit}{item.city ? ` · ${item.city}${item.country ? `, ${item.country}` : ''}` : ''}</p>{item.properties?.map((property)=><p key={property.name}>Quality: {property.name} {property.minimum ?? 'any'}–{property.maximum ?? 'any'} {property.unit}</p>)}<Actions><Button $compact type="button" onClick={()=>startEditing(item)}>Edit</Button><Button $compact $secondary type="button" onClick={()=>close(item.requirement_id)}>Close requirement</Button></Actions></Item>)}
  </Page>;
};
export default RequirementsPage;
