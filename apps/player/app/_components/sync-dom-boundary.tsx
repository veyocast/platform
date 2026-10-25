"use client";
import {Component,useEffect,type ReactNode}from'react';

/** No raster is invented for v2. Recovery uses the existing verified releases. */
export function SyncDomFailure({report,passive}:{report:()=>void;passive:boolean}){
 useEffect(()=>{if(!passive)report();},[report,passive]);return null;
}
/** Retain the last painted, trusted DOM tree during a render exception. This
 * bounded, passive copy contains only our renderer's already verified nodes;
 * no provider HTML or executable input is admitted. It is replaced by normal
 * Player LKG recovery, and is never persisted or exported as a screenshot. */
export class SyncDomBoundary extends Component<{children:ReactNode;report:()=>void;passive:boolean;revision:string},{failed:boolean}>{
 override state={failed:false};
 private host:HTMLDivElement|null=null;
 private retained:Node|null=null;
 private lastPainted:Node|null=null;
 override getSnapshotBeforeUpdate(previousProps:Readonly<typeof this.props>,previous:Readonly<{failed:boolean}>){
  if(!previous.failed&&previousProps.revision!==this.props.revision)this.lastPainted=this.host?.cloneNode(true)??null;
  return this.state.failed&&!previous.failed?this.lastPainted??this.host?.cloneNode(true)??null:null;
 }
 static getDerivedStateFromError(){return{failed:true};}
 override componentDidUpdate(previous:Readonly<typeof this.props>,_state:Readonly<{failed:boolean}>,snapshot:Node|null){
  if(this.state.failed&&snapshot&&this.host){this.retained=snapshot;this.host.replaceChildren(snapshot);}
  if(this.state.failed&&previous.revision!==this.props.revision)this.setState({failed:false});
  if(!this.state.failed&&this.retained?.parentNode===this.host){this.host?.removeChild(this.retained);this.retained=null;}
 }
 override componentDidCatch(){if(!this.props.passive)this.props.report();}
 override render(){return <div ref={node=>{this.host=node;}} style={{width:'100%',height:'100%'}}>{this.state.failed?null:this.props.children}</div>;}
}
