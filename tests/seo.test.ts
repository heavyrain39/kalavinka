import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {messages} from '../src/i18n.ts';

const BASE='https://heavyrain39.github.io/kalavinka/';
const pages=[{file:'index.html',lang:'en',url:BASE,up:'./'},{file:'ko/index.html',lang:'ko',url:BASE+'ko/',up:'../'}] as const;
const read=(file:string)=>readFileSync(file,'utf8');
const attr=(html:string,pattern:RegExp)=>html.match(pattern)?.[1];
const decode=(text:string)=>text.replace(/&amp;/g,'&');

test('the English and Korean pages point at each other and at themselves',()=>{
  for(const page of pages){
    const html=read(page.file);
    assert.equal(attr(html,/<html lang="(\w+)"/),page.lang,page.file);
    assert.equal(attr(html,/<link rel="canonical" href="([^"]+)"/),page.url,page.file);
    assert.equal(attr(html,/<meta property="og:url" content="([^"]+)"/),page.url,page.file);
    assert.match(html,new RegExp(`<link rel="alternate" hreflang="en" href="${BASE}" />`));
    assert.match(html,new RegExp(`<link rel="alternate" hreflang="ko" href="${BASE}ko/" />`));
    assert.match(html,new RegExp(`<link rel="alternate" hreflang="x-default" href="${BASE}" />`));
    const ld=JSON.parse(html.split('application/ld+json">')[1].split('</script>')[0]);
    assert.equal(ld.url,page.url);
  }
  const sitemap=read('public/sitemap.xml');
  for(const page of pages)assert.match(sitemap,new RegExp(`<loc>${page.url}</loc>`));
  assert.equal(sitemap.match(/hreflang="ko"/g)?.length,2);
});

test('each page carries its own language: title, description, social card and the crawlable overview',()=>{
  for(const page of pages){
    const html=read(page.file),text=messages[page.lang];
    assert.equal(decode(attr(html,/<meta name="description" content="([^"]+)"/)!),text.description,page.file);
    assert.equal(decode(attr(html,/<meta property="og:description" content="([^"]+)"/)!),text.description,page.file);
    const card=attr(html,/<meta property="og:image" content="([^"]+)"/)!;
    assert.equal(card,`${BASE}${page.lang==='ko'?'social-card-ko.png':'social-card.png'}`);
    assert.equal(attr(html,/<meta name="twitter:image" content="([^"]+)"/),card);
    assert.ok(existsSync('public/'+card.slice(BASE.length)),card);
    // The overview the player moves into its dialog is the app's own copy, in the page's language.
    const keyed=[...html.matchAll(/<(\w+)[^>]*data-i18n="(\w+)"[^>]*>([^<]*)<\/\1>/g)];
    assert.ok(keyed.length>=9,page.file);
    for(const [,,key,content] of keyed)assert.equal(decode(content),text[key as keyof typeof text],`${page.file} ${key}`);
  }
  assert.match(read('ko/index.html'),/<title>[^<]*노동요[^<]*<\/title>/);
  assert.match(read('ko/index.html'),/data-page-language="ko"/);
});

test('icons and files are reachable from both pages',()=>{
  for(const page of pages){
    const html=read(page.file);
    assert.match(html,new RegExp(`<link rel="icon" type="image/svg\\+xml" href="${page.up}favicon.svg" />`));
    assert.match(html,new RegExp(`<link rel="apple-touch-icon" href="${page.up}apple-touch-icon.png" />`));
    assert.match(html,new RegExp(`<link rel="sitemap" type="application/xml" href="${page.up}sitemap.xml" />`));
  }
  for(const file of ['favicon.svg','apple-touch-icon.png','social-card.png','social-card-ko.png','sitemap.xml'])assert.ok(existsSync('public/'+file),file);
  const png=readFileSync('public/apple-touch-icon.png');
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[180,180]);
  for(const file of ['social-card.png','social-card-ko.png']){const card=readFileSync('public/'+file);assert.deepEqual([card.readUInt32BE(16),card.readUInt32BE(20)],[1200,630],file);}
});
