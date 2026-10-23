'use client';
import {type ReactNode} from 'react';
import {Inbox} from 'lucide-react';
import './ui.css';
export {Button,Field,Modal,Badge} from '../shared';

export type PageHeadingProps={title:string;description?:string;eyebrow?:string;actions?:ReactNode};
export function PageHeading({title,description,eyebrow,actions}:PageHeadingProps){return <header className="ui-page-heading"><div>{eyebrow&&<span className="ui-eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="ui-heading-actions">{actions}</div>}</header>}
export type SectionCardProps={title?:string;description?:string;children:ReactNode;className?:string;actions?:ReactNode};
export function SectionCard({title,description,children,className='',actions}:SectionCardProps){return <section className={`ui-section-card ${className}`}>{(title||description||actions)&&<header className="ui-section-heading"><div>{title&&<h2>{title}</h2>}{description&&<p>{description}</p>}</div>{actions&&<div className="ui-section-actions">{actions}</div>}</header>}<div className="ui-section-content">{children}</div></section>}
export type SegmentedControlProps<T extends string>={items:{value:T;label:ReactNode}[];value:T;onChange:(value:T)=>void;label:string;className?:string};
export function SegmentedControl<T extends string>({items,value,onChange,label,className=''}:SegmentedControlProps<T>){return <div className={`ui-segmented ${className}`} role="group" aria-label={label}>{items.map(item=><button key={item.value} type="button" aria-pressed={item.value===value} onClick={()=>onChange(item.value)}>{item.label}</button>)}</div>}
export type EmptyStateProps={icon?:ReactNode;title:string;description?:string;action?:ReactNode};
export function EmptyState({icon,title,description,action}:EmptyStateProps){return <div className="ui-empty-state"><span className="ui-empty-icon">{icon||<Inbox size={27}/>}</span><h3>{title}</h3>{description&&<p>{description}</p>}{action&&<div className="ui-empty-action">{action}</div>}</div>}
export type StatCardProps={label:string;value:ReactNode;detail?:ReactNode;icon?:ReactNode};
export function StatCard({label,value,detail,icon}:StatCardProps){return <article className="ui-stat-card"><div><span className="ui-stat-label">{label}</span><strong className="ui-stat-value">{value}</strong>{detail&&<span className="ui-stat-detail">{detail}</span>}</div>{icon&&<span className="ui-stat-icon">{icon}</span>}</article>}
export type ToggleSwitchProps={label:string;description?:string;checked:boolean;onChange:(checked:boolean)=>void;disabled?:boolean};
export function ToggleSwitch({label,description,checked,onChange,disabled=false}:ToggleSwitchProps){return <label className={`ui-toggle-switch ${disabled?'is-disabled':''}`}><input type="checkbox" checked={checked} disabled={disabled} onChange={event=>onChange(event.target.checked)}/><span className="ui-toggle-track"/><span><strong>{label}</strong>{description&&<small>{description}</small>}</span></label>}
