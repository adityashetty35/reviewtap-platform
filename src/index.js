const enc=new TextEncoder();
const page=(body)=>new Response('<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ReviewTap</title><style>body{font:16px system-ui;background:#f3f5fb;color:#18233c;margin:0}main{max-width:1100px;margin:35px auto;padding:24px}header{background:#14264b;color:white;padding:22px 30px}h1{margin:0}button,input,select{font:inherit;padding:10px;border:1px solid #cad2e2;border-radius:8px}button{background:#3159e8;color:white;cursor:pointer}article{background:white;border-radius:14px;padding:20px;margin:18px 0;box-shadow:0 2px 10px #ddd}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}input{max-width:95%}a{color:#3159e8}.scroll{overflow:auto}</style><header><h1>ReviewTap</h1></header><main>'+body+'</main></html>',{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"}});
const json=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
const idok=s=>/^[a-f0-9]{16}$/.test(s);
const cookie=r=>(r.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('rt='))?.slice(3);
async function sig(secret,payload){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(payload)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function authorized(req,env){if(!env.SESSION_SECRET)return false;const v=cookie(req);if(!v)return false;const [expiry,mac]=v.split('.');if(!/^\d+$/.test(expiry)||Number(expiry)<Date.now()||!/^[a-f0-9]{64}$/.test(mac||''))return false;return (await sig(env.SESSION_SECRET,expiry))===mac;}
const validUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&s.length<=2000;}catch{return false;}};

function zipStore(entries){
const encoder=new TextEncoder(),chunks=[];let offset=0;const directory=[];
const put=(b)=>{chunks.push(b);offset+=b.length};
const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const crc32=(data)=>{let c=0xffffffff;for(const byte of data){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0};
for(const [name,content] of entries){const n=encoder.encode(name),data=typeof content==='string'?encoder.encode(content):content,crc=crc32(data),start=offset;put(Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(n.length),...u16(0)]));put(n);put(data);
directory.push(Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(start)]),n);}
const dirStart=offset;for(const b of directory)put(b);
put(Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),...u16(entries.length),...u16(entries.length),...u32(offset-dirStart),...u32(dirStart),...u16(0)]));
return new Blob(chunks,{type:'application/zip'});
}
const dashboard=`<article><h2>Cards</h2><button onclick="generate()">Generate 50 cards</button> <a href="/api/export.csv">Download dealer CSV</a> <a href="/api/qr-codes.zip" style="display:inline-block;padding:11px 14px;border-radius:8px;background:#16805d;color:white;text-decoration:none;font-weight:600">⬇ Download All QR Codes (ZIP)</a> <button onclick="load()">Refresh</button><p id="notice"></p></article><article class="scroll"><table><thead><tr><th>Card / QR</th><th>Business</th><th>Google review link</th><th>Status</th><th>Scans</th><th>Save</th></tr></thead><tbody id="rows"></tbody></table></article><form action="/admin/logout" method="post"><button>Log out</button></form><script>
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){const r=await fetch('/api/cards');if(!r.ok){location.href='/admin/login';return;}const d=await r.json();document.querySelector('#rows').innerHTML=d.cards.map(c=>'<tr data-id="'+c.id+'"><td><a target="_blank" href="/qr/'+c.id+'.svg">QR SVG</a><br><small>'+c.id+'</small><br><a target="_blank" href="/r/'+c.id+'">Test</a></td><td><input class="business" value="'+esc(c.business)+'"></td><td><input class="destination" type="url" placeholder="https://..." value="'+esc(c.destination)+'"></td><td><select class="status">'+['unassigned','active','paused'].map(s=>'<option '+(c.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></td><td>'+c.scans+'</td><td><button onclick="save(this)">Save</button></td></tr>').join('');}
async function generate(){if(!confirm('Create 50 new unique cards?'))return;const r=await fetch('/api/generate',{method:'POST'});const d=await r.json();document.querySelector('#notice').textContent=d.error||('Created '+d.created+' cards');load();}
async function save(btn){const row=btn.closest('tr');const body={business:row.querySelector('.business').value,destination:row.querySelector('.destination').value,status:row.querySelector('.status').value};const r=await fetch('/api/card/'+row.dataset.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();alert(d.error||'Saved');if(r.ok)load();}
load();
</script>`;
export default {async fetch(req,env){try{return await route(req,env)}catch(e){console.error(e);return json({error:'Server error'},500)}}};
async function route(req,env){
const u=new URL(req.url),p=u.pathname,m=req.method,base=u.origin;
if(p==='/health')return json({ok:true});
if(p==='/')return Response.redirect(base+'/admin',302);
if(p.startsWith('/r/')&&m==='GET'){const id=p.slice(3);if(!idok(id))return page('<h2>Card not found</h2>');const c=await env.DB.prepare('SELECT destination,status FROM cards WHERE id=?').bind(id).first();if(!c)return page('<h2>Card not found</h2>');if(c.status!=='active'||!c.destination)return page('<h2>This card has not been activated yet.</h2>');if(!validUrl(c.destination))return page('<h2>Destination unavailable</h2>');await env.DB.prepare('UPDATE cards SET scans=scans+1 WHERE id=?').bind(id).run();return new Response(null,{status:302,headers:{location:c.destination,'cache-control':'no-store','referrer-policy':'no-referrer'}});}
if(p.startsWith('/qr/')&&p.endsWith('.svg')&&m==='GET'){const id=p.slice(4,-4);if(!idok(id))return json({error:'Not found'},404);const c=await env.DB.prepare('SELECT id FROM cards WHERE id=?').bind(id).first();if(!c)return json({error:'Not found'},404);const q='https://api.qrserver.com/v1/create-qr-code/?size=512x512&format=svg&ecc=H&data='+encodeURIComponent(base+'/r/'+id);const res=await fetch(q);if(!res.ok)return json({error:'QR generation unavailable'},503);return new Response(res.body,{headers:{'content-type':'image/svg+xml','x-content-type-options':'nosniff','cache-control':'public,max-age=86400'}});}
if(p==='/admin/login'&&m==='GET')return page('<article><h2>Admin login</h2><form method="post"><input type="password" name="password" placeholder="Admin password" required> <button>Sign in</button></form></article>');
if(p==='/admin/login'&&m==='POST'){if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return page('<p>Set ADMIN_PASSWORD and SESSION_SECRET first.</p>');const f=await req.formData();if(String(f.get('password'))!==env.ADMIN_PASSWORD)return page('<h2>Wrong password</h2><a href="/admin/login">Try again</a>');const expiry=String(Date.now()+86400000),mac=await sig(env.SESSION_SECRET,expiry);return new Response(null,{status:303,headers:{location:'/admin','set-cookie':'rt='+expiry+'.'+mac+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400'}});}
if(p==='/admin/logout'&&m==='POST')return new Response(null,{status:303,headers:{location:'/admin/login','set-cookie':'rt=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'}});
if(p==='/admin'||p.startsWith('/api/')){if(!await authorized(req,env))return p==='/admin'?Response.redirect(base+'/admin/login',302):json({error:'Unauthorized'},401);
if(p==='/admin'&&m==='GET')return page(dashboard);
if(p==='/api/cards'&&m==='GET')return json({cards:(await env.DB.prepare('SELECT * FROM cards ORDER BY created_at,id').all()).results});
if(p==='/api/generate'&&m==='POST'){const count=(await env.DB.prepare('SELECT COUNT(*) n FROM cards').first()).n;if(count>=5000)return json({error:'Limit of 5000 cards'},400);const ids=Array.from({length:Math.min(50,5000-count)},()=>[...crypto.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,'0')).join(''));await env.DB.batch(ids.map(id=>env.DB.prepare('INSERT INTO cards(id) VALUES(?)').bind(id)));return json({created:ids.length});}
const match=p.match(/^\/api\/card\/([a-f0-9]{16})$/);if(match&&m==='PATCH'){const b=await req.json().catch(()=>({}));const business=String(b.business||'').trim(),dest=String(b.destination||'').trim(),status=b.status;if(business.length>120||!['unassigned','active','paused'].includes(status)||dest&&!validUrl(dest)||status==='active'&&(!business||!dest))return json({error:'Check business, HTTPS link and status'},400);const result=await env.DB.prepare('UPDATE cards SET business=?,destination=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(business,dest,status,match[1]).run();return json({ok:!!result.meta.changes});}
if(p==='/api/qr-codes.zip'&&m==='GET'){
const cards=(await env.DB.prepare('SELECT id FROM cards ORDER BY created_at,id LIMIT 500').all()).results;
if(!cards.length)return json({error:'Generate cards first'},400);
const entries=[];
for(let i=0;i<cards.length;i+=10){
const batch=cards.slice(i,i+10);
const results=await Promise.all(batch.map(async(c)=>{const url=base+'/r/'+c.id;const q='https://api.qrserver.com/v1/create-qr-code/?size=512x512&format=svg&ecc=H&data='+encodeURIComponent(url);const response=await fetch(q);if(!response.ok)throw new Error('QR provider error');const svg=await response.text();if(!svg.includes('<svg'))throw new Error('Invalid QR image');return ['QR-'+c.id+'.svg',svg]}));
entries.push(...results);
}
entries.push(['README.txt','ReviewTap dealer QR files\\nEach QR-NUMBER.svg encodes the permanent URL for that card.\\nProgram each NFC chip with the matching URL.\\nDO NOT print until you test the scans.\\n']);
return new Response(zipStore(entries),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="reviewtap-qr-codes.zip"','cache-control':'no-store'}});
}
if(p==='/api/export.csv'&&m==='GET'){const rows=(await env.DB.prepare('SELECT id,business,status FROM cards ORDER BY created_at,id').all()).results;const csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';const lines=[['id','qr_link','svg_link','business','status'].map(csv).join(',')];for(const c of rows)lines.push([c.id,base+'/r/'+c.id,base+'/qr/'+c.id+'.svg',c.business,c.status].map(csv).join(','));return new Response('\uFEFF'+lines.join('\r\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="reviewtap-dealer.csv"','cache-control':'no-store'}});}
}
return json({error:'Not found'},404);
}