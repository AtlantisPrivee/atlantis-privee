const toolCurrency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const toolNumberFormats = new Map();
const money = value => toolCurrency.format(value);
function fmt(value, digits = 2) {
  if (!toolNumberFormats.has(digits)) toolNumberFormats.set(digits, new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }));
  return toolNumberFormats.get(digits).format(value);
}
const sum = a => a.reduce((s,x)=>s+Number(x),0);
const round = v => Math.round((v+Number.EPSILON)*100)/100;
const norm = s => String(s??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
const dateValue = s => {if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Enter a complete calendar date.');const z=new Date(s+'T00:00:00Z');if(!Number.isFinite(+z)||z.toISOString().slice(0,10)!==s)throw Error('Enter a valid calendar date.');return +z;};
const days = (a,b) => Math.round((dateValue(b)-dateValue(a))/86400000);
const weekdays = (a,b) => {const k=days(a,b);if(k<0)throw Error('The end date must be on or after the start date.');if(k>36600)throw Error('Use a date range of 100 years or less.');let n=0;for(let i=0;i<=k;i++){const w=new Date(dateValue(a)+i*86400000).getUTCDay();if(w!==0&&w!==6)n++;}return n;};
const ordered = (a,key='date') => [...a].sort((x,y)=>String(x[key]).localeCompare(String(y[key])));
const groupBy = (a,key) => {const map=new Map();for(const x of a){const k=key(x);if(!map.has(k))map.set(k,[]);map.get(k).push(x);}return [...map.values()];};
const metric = (label,value,detail='') => ({label,value,detail});
const table = (headers,rows) => ({headers,rows});
const result = (title,metrics=[],data=null,notes=[],series=[]) => ({title,metrics,table:data,notes,series});
const sha256Bytes = bytes => {
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],len=bytes.length,padded=new Uint8Array(Math.ceil((len+9)/64)*64);padded.set(bytes);padded[len]=128;const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(len/0x20000000));view.setUint32(padded.length-4,(len*8)>>>0);const w=new Int32Array(64),rot=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let off=0;off<padded.length;off+=64){for(let i=0;i<16;i++)w[i]=view.getInt32(off+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=rot(a,7)^rot(a,18)^(a>>>3),s1=rot(b,17)^rot(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}let [a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const s1=rot(e,6)^rot(e,11)^rot(e,25),ch=(e&f)^(~e&g),t1=(z+s1+ch+k[i]+w[i])|0,s0=rot(a,2)^rot(a,13)^rot(a,22),maj=(a&b)^(a&c)^(b&c),t2=(s0+maj)|0;z=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}[a,b,c,d,e,f,g,z].forEach((x,i)=>h[i]=(h[i]+x)|0);}
 return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
};
const fingerprint = async file => {const bytes=await file.arrayBuffer();if(globalThis.crypto?.subtle){const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}return sha256Bytes(new Uint8Array(bytes));};

