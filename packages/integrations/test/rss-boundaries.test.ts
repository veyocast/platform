import {describe,it,expect}from'vitest';
import {canonicalNewsArticleSchema}from'@veyocast/contracts';
import {parseRssOrAtom,RssParseError}from'../src/rss';
describe('RSS parser and completion headline boundary',()=>{
 it('keeps a full 400-character headline inside the canonical contract',()=>{
  const title='K'.repeat(400),feed=parseRssOrAtom(`<rss><channel><title>Supplier</title><item><title>${title}</title><link>https://news.example.test/article</link></item></channel></rss>`,'https://news.example.test/rss');
  expect(canonicalNewsArticleSchema.parse(feed.articles[0]).title).toBe(title);
 });
 it('rejects overlong headlines before media work without silently truncating or dropping the article',()=>{
  expect(()=>parseRssOrAtom(`<rss><channel><title>Supplier</title><item><title>${'K'.repeat(401)}</title><link>https://news.example.test/article</link></item></channel></rss>`,'https://news.example.test/rss')).toThrow(RssParseError);
 });
});
