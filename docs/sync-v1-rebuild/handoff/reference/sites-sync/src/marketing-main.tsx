import React from 'react';
import {createRoot} from 'react-dom/client';
import {MotionConfig} from 'motion/react';
import Marketing from './Marketing';
import './styles.css';

// The public bundle intentionally has no tenant store, admin modules or device fixtures.
const appHref='https://veyocast-v1-design-lab.dgwebserv.chatgpt.site/?design=sync';
createRoot(document.getElementById('root')!).render(<MotionConfig reducedMotion="user"><Marketing appHref={appHref} onPlayer={()=>{window.location.href=appHref+'&player=s1';}}/></MotionConfig>);
