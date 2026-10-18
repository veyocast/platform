import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AppProvider} from './store';
import './styles.css';
class Boundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true}}render(){return this.state.error?<main style={{padding:60,fontFamily:'sans-serif'}}><h1>Dit scherm kon niet openen.</h1><p>Je bewaarde demodata blijven beschikbaar.</p><button onClick={()=>location.href=location.pathname}>Terug naar VeyoCast</button></main>:this.props.children}}
createRoot(document.getElementById('root')!).render(<Boundary><AppProvider><App/></AppProvider></Boundary>);
