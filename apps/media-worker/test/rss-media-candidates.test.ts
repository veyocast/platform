import{it,expect,vi}from'vitest';
import sharp from'sharp';
import{parseRssOrAtom}from'@veyocast/integrations';
const f=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@veyocast/integrations/server',()=>({fetchSafeRssImage:f.fetch}));
import{prepareRssMediaArtifacts}from'../src/rss-media';
it('acquires all twenty selected images, safely tries declared alternatives, and keeps text-only items valid',async()=>{
 const bytes=await sharp({create:{width:100,height:60,channels:3,background:'#345678'}}).png().toBuffer();
 f.fetch.mockImplementation(async(url:string)=>{if(url.endsWith('/broken.jpg'))throw Error('safe_media_failure');return{body:bytes};});
 const feed=parseRssOrAtom(`<rss xmlns:picture="http://search.yahoo.com/mrss/"><channel><title>Eigen uitgever</title>${Array.from({length:21},(_,n)=>`<item><guid>${n}</guid><title>Artikel ${n}</title><link>https://example.org/${n}</link>${n<20?`<picture:content url="/broken.jpg" width="1920"/><picture:thumbnail url="/photo-${n}.png"/>`:''}</item>`).join('')}</channel></rss>`,'https://example.org/feed.xml');
 const artifacts=await prepareRssMediaArtifacts({tenantId:'10000000-0000-4000-8000-000000000291',dataSourceId:'20000000-0000-4000-8000-000000000291',runId:'30000000-0000-4000-8000-000000000291',sourceUrl:'https://example.org/feed.xml'},feed);
 expect(artifacts.filter(a=>a.role==='article_hero')).toHaveLength(20);
 expect(artifacts.filter(a=>a.role==='article_qr')).toHaveLength(21);
 expect(artifacts.find(a=>a.externalId==='20'&&a.role==='article_hero')).toBeUndefined();
 expect(f.fetch).toHaveBeenCalledWith('https://example.org/photo-19.png');
});
