/** Additive widget geometry; typography, scenery and surfaces come from v17. */
export const sitesMenuWidgetCss = String.raw`
@font-face{font-family:'Manrope Variable';src:url('/fonts/manrope.woff2') format('woff2');font-weight:200 800;font-style:normal;font-display:swap}
.vm-frame{position:relative;flex:none;overflow:hidden;max-width:100%}
.vm-canvas .uc-body{margin:var(--vm-inset);width:calc(1776px - var(--vm-inset)*2);height:calc(790px - var(--vm-inset)*2)}
.vm-canvas.uc-portrait .uc-body{width:calc(952px - var(--vm-inset)*2);height:calc(1530px - var(--vm-inset)*2)}
.vm-canvas .uc-header-copy{text-align:var(--vm-align)}
.vm-canvas .uc-slide-title{font-size:calc(66px * var(--vm-scale))}
.vm-canvas .uc-slide-title[data-length=medium]{font-size:calc(58px * var(--vm-scale))}
.vm-canvas .uc-slide-title[data-length=long]{font-size:calc(32px * var(--vm-scale))}
.vm-canvas.uc-portrait .uc-slide-title{font-size:calc(58px * var(--vm-scale))}
.vm-canvas.uc-portrait .uc-slide-title[data-length=medium]{font-size:calc(51px * var(--vm-scale))}
.vm-canvas.uc-portrait .uc-slide-title[data-length=long]{font-size:calc(37px * var(--vm-scale))}
.vm-content{transform:scale(var(--led-auto-fit,1));transform-origin:top left}
.vm-canvas .vm-widgets{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:dense;align-content:start;flex:none;min-width:0}
.vm-canvas .vm-widgets[data-columns="1"],.vm-canvas .vm-widgets[data-full=true]{grid-template-columns:1fr}
.vm-widget{min-width:0;min-height:0;overflow:hidden}
.vm-widget[data-column=full]{grid-column:1/-1}
.vm-widget[data-column=left]{grid-column:1}
.vm-widget[data-column=right]{grid-column:2}
.vm-widgets[data-columns="1"]>.vm-widget{grid-column:1}
.vm-canvas.vm-custom-accent .vm-widget>header{background:var(--vm-accent)!important;color:var(--vm-accent-ink)!important}
.vm-widget>header>div{flex:1;min-width:0;text-align:var(--vm-align)}
.vm-canvas .vm-widget h2{font-size:calc(40px * var(--vm-scale));overflow-wrap:anywhere}
.vm-canvas.uc-portrait .vm-widget h2{font-size:calc(43px * var(--vm-scale))}
.vm-canvas .vm-widget header p{font-size:calc(22px * var(--vm-scale));font-weight:400;line-height:1.3;margin-top:8px;white-space:pre-wrap}
.vm-canvas .vm-widget>.vm-widget-content{display:block}
.vm-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:38px;min-width:0}
.vm-products[data-columns="1"]{grid-template-columns:1fr}
.vm-product-column{min-width:0}
.vm-canvas .vm-product>span{flex:1;min-width:0;max-width:none;font-size:calc(24px * var(--vm-scale));text-align:var(--vm-align)}
.vm-product strong{display:block;font-weight:750;overflow-wrap:anywhere}
.vm-product small{display:block;font-size:calc(20px * var(--vm-scale));font-weight:400;line-height:1.3;margin-top:6px;overflow-wrap:anywhere}
.vm-canvas .vm-product>b{font-size:calc(31px * var(--vm-scale))}
.vm-canvas.vm-custom-accent .vm-product>b{color:var(--vm-accent)}
.vm-canvas.uc-portrait .vm-product>b{font-size:calc(34px * var(--vm-scale))}
.vm-product>img{width:64px;height:64px;object-fit:contain;flex:none}
.vm-widget-image{margin:0;min-width:0;height:var(--vm-widget-height);display:flex;align-items:center;justify-content:center;overflow:hidden}
.vm-widget-image>img{width:100%;height:100%;min-height:0;object-fit:contain;max-width:100%}
.vm-widget-image[data-ratio="9:16"]>img{width:min(var(--vm-image-width),calc(var(--vm-widget-height)*.5625));height:auto;aspect-ratio:9/16;max-height:100%}
.vm-widget-image[data-ratio="16:9"]>img{width:min(var(--vm-image-width),calc(var(--vm-widget-height)*1.77778));height:auto;aspect-ratio:16/9;max-height:100%}
`;
