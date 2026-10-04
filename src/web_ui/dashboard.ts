/** Self-contained UI: no filesystem paths or third-party scripts at runtime. */
export const dashboard = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MediaFlow • Workspace</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0b1020;color:#e5ecfa}*{box-sizing:border-box}body{margin:0}button,input,select,textarea{font:inherit}button,a.button{border:1px solid #405778;border-radius:8px;background:#233753;color:#eff6ff;padding:10px 15px;cursor:pointer;text-decoration:none}button:hover,a.button:hover{background:#315077}button.primary{background:#3474ed;border-color:#3474ed}button:disabled{opacity:.5;cursor:wait}input,select,textarea{width:100%;background:#0b1427;border:1px solid #334564;color:#e5ecfa;border-radius:8px;padding:11px}input:focus,select:focus,textarea:focus,button:focus-visible{outline:2px solid #72afff;outline-offset:2px}textarea{min-height:90px;resize:vertical}label{display:block;font-size:.85rem;color:#bbcae2;margin-bottom:7px}.shell{display:grid;grid-template-columns:240px 1fr;min-height:100vh}aside{padding:28px 18px;background:#101a2d;border-right:1px solid #253653}h1{font-size:1.4rem;margin:0 0 6px}aside p{font-size:.8rem;margin:0 0 28px}nav{display:grid;gap:6px}nav button{text-align:left;background:transparent;border-color:transparent}nav button[aria-current="page"]{background:#233f67;border-color:#3a669a}main{padding:32px;max-width:1250px;width:100%}h2{font-size:1.9rem;margin:0 0 8px;letter-spacing:-.04em}h3{margin:0 0 15px;font-size:1rem}p,.muted{color:#9eafca;line-height:1.6}.top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:30px}.badge{border:1px solid #3b5475;padding:7px 12px;border-radius:99px;font-size:.8rem}.card{background:#121e33;border:1px solid #293b58;border-radius:14px;padding:22px;margin:18px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px}pre{background:#091224;border-radius:8px;padding:16px;max-height:420px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.85rem}video{width:100%;max-height:450px;background:#000;border-radius:10px}small{display:block;color:#a0b1cb;margin-top:6px}.notice{border-left:3px solid #f8c56d;padding:10px 14px;background:#2c2630;color:#e8d4af}.tile{text-align:left;padding:20px;display:block;width:100%}.tile strong{display:block;margin-bottom:8px}.tile span{color:#a9bad3;font-size:.85rem}.hidden,[hidden]{display:none!important}.result-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.error{color:#ffaeae}.ok{color:#90e4c3}footer{margin-top:30px;color:#8fa5c4;font-size:.8rem}.stat{font-size:1.5rem;font-weight:600}#request-url{font-family:monospace}.password{max-width:300px}.check{display:flex;align-items:center;gap:10px}.check input{width:auto}@media(max-width:760px){.shell{display:block}aside{padding:18px;border-right:0;border-bottom:1px solid #293b58}aside p{margin-bottom:12px}nav{display:flex;overflow:auto}nav button{white-space:nowrap}main{padding:20px}.top{align-items:flex-start;flex-direction:column}}
</style></head><body><div class="shell"><aside><h1>◈ MediaFlow</h1><p>Proxy & streaming workspace</p><nav aria-label="Tools" id="nav"></nav><footer>Cloudflare Worker Edition<br>No external UI dependencies</footer></aside><main>
<div class="top"><div><h2 id="title">Overview</h2><p id="subtitle">Your streaming tools, in one place.</p></div><span class="badge" id="health" role="status">Checking service…</span></div>
<details class="card"><summary>API access settings</summary><p>This version of the Worker accepts public requests. An optional API password is passed to endpoints for compatible deployments. It stays in memory until this page is closed.</p><label for="api-password">API password</label><input class="password" id="api-password" type="password" autocomplete="off"><button id="clear-password" type="button">Clear</button></details>
<section id="overview"><div class="grid"><div class="card"><h3>Worker</h3><div class="stat" id="version">—</div><small id="service-detail">Waiting for health check</small></div><div class="card"><h3>Extractor hosts</h3><div class="stat" id="host-count">—</div><small>Detected from the live Worker</small></div><div class="card"><h3>MCP tools</h3><div class="stat" id="tool-count">—</div><small>Public tool discovery</small></div></div><div class="grid" id="tiles"></div><div class="actions"><button id="refresh">Refresh status</button></div><p class="notice">Xtream currently returns sample or empty data; no IPTV provider is connected. AceStream and Telegram require a container deployment and are unavailable in this Worker.</p></section>
<section id="workspace" hidden><div class="card"><label for="operation">Operation</label><select id="operation"></select><p id="description"></p><form id="tool-form"><div class="grid" id="fields"></div><details style="margin-top:18px" id="advanced"><summary>Custom upstream headers & extra parameters</summary><p>One key=value per line. Use h_Referer, h_User_Agent or h_Authorization for upstream headers.</p><label for="extra">Additional parameters</label><textarea id="extra" placeholder="h_Referer=https://example.com/"></textarea></details><div class="actions"><button class="primary" type="submit">Run request</button><button type="button" id="generate">Generate URL</button><button type="button" id="cancel" disabled>Cancel</button></div></form></div>
<div class="card" id="url-card" hidden><h3>Request URL</h3><input id="request-url" readonly aria-label="Generated request URL"><small>Generated links include any credentials entered above. Share only with people who should have access.</small><div class="actions"><button id="copy-url">Copy URL</button><a class="button" id="open-url" target="_blank" rel="noopener noreferrer">Open</a><button id="play-url">Play</button></div></div>
<div class="card" id="result-card" hidden><div class="result-title"><h3>Response</h3><span id="response-status" role="status"></span></div><pre id="result"></pre><div class="actions" id="stream-actions"></div><div class="actions"><button id="copy-result">Copy response</button><button id="download-result">Download response</button></div></div></section>
<section id="player-section" hidden class="card"><h3>Media player</h3><label for="media-url">Media or generated proxy URL</label><input id="media-url" type="url" placeholder="https://…"><div class="actions"><button id="load-media" class="primary">Load media</button><button id="stop-media">Stop</button></div><p>Uses your browser's native playback. MP4 and supported audio work directly; HLS and DASH support depends on the browser. Use a generated URL in VLC or another compatible player if the format is unsupported.</p><video id="player" controls playsinline preload="none"></video><p id="player-status" role="status"></p></section>
<section id="playlist-section" hidden class="card"><h3>M3U playlist builder</h3><p>Enter one channel per line: name|url|group|logo. Group and logo are optional.</p><label for="channels">Channels</label><textarea id="channels" rows="8" placeholder="Channel name|https://example.com/live.m3u8|News|https://example.com/logo.png"></textarea><label class="check"><input type="checkbox" id="proxy-playlist">Route channel URLs through this Worker</label><div class="actions"><button class="primary" id="build-playlist">Build playlist</button><button id="save-playlist" disabled>Download .m3u</button><button id="copy-playlist" disabled>Copy</button></div><pre id="playlist-output" aria-live="polite">Your playlist will appear here.</pre></section>
<section id="speed-section" hidden class="card"><h3>Proxy speed test</h3><p>Download a fixed amount of test data from Cloudflare through this Worker.</p><label for="test-size">Download size</label><select id="test-size"><option value="1000000">1 MB</option><option value="10000000" selected>10 MB</option><option value="25000000">25 MB</option></select><div class="actions"><button class="primary" id="run-speed">Start test</button><button id="cancel-speed" disabled>Cancel</button></div><pre id="speed-output" aria-live="polite">Ready to test.</pre></section>
<p id="feedback" role="status" aria-live="polite"></p></main></div>
<script>
const $ = id => document.getElementById(id);
const field = (name,label,options) => ({name,label,...options});
const destination = field('d','Destination URL or Base64 URL',{required:true});
const choices = (name,label,values) => field(name,label,{values});
const op = (id,label,path,fields=[],description='',method='GET',media=false) => ({id,label,path,fields,description,method,media});
const groups = [
 {id:'overview',label:'Overview',description:'Your streaming tools, in one place.'},
 {id:'proxy',label:'Stream proxy',description:'Build playback links or inspect upstream responses.',operations:[
 op('stream','HTTP stream','/proxy/stream',[destination,field('range','Byte range (optional)'),choices('method','Upstream method',['','GET','HEAD'])],'Generic streaming with byte-range support. Response previews stop after 256 KiB.', 'GET',true),
 op('hls','HLS manifest','/proxy/hls/manifest.m3u8',[destination],'Rewrite an HLS manifest to route its segments through this Worker.','GET',true),
 op('hls-segment','HLS segment','/proxy/hls/segment.ts',[destination],'Proxy an individual HLS media segment.'),
 op('dash','DASH manifest','/proxy/mpd/manifest.m3u8',[destination],'Process a DASH/MPD manifest using the Worker endpoint.','GET',true),
 op('dash-segment','DASH segment','/proxy/mpd/segment.mp4',[destination],'Proxy an individual DASH media segment.'),
 op('epg','EPG / XMLTV proxy','/proxy/epg',[destination,field('cache_ttl','Cache TTL in seconds',{type:'number',min:0})],'Fetch XMLTV with configurable caching.') ]},
 {id:'extract',label:'Video extraction',description:'Discover direct media links and resolve redirect pages.',operations:[
 op('extract','Extract video','/extractor/video',[destination,field('host','Host (blank = auto-detect)',{list:'hosts'}),choices('redirect_stream','Redirect to media',['','false','true'])],'Select generic for an unrecognized host. Protected hosts may reject extraction.'),
 op('resolve','Universal resolver','/resolve',[destination,choices('redirect_stream','Redirect to media',['','false','true'])]),
 op('redirect','Resolve redirect','/resolve_redirect',[destination]),
 op('multi','Resolve & extract multiple streams','/resolve_redirect/extract',[destination,choices('output_format','Output format',['json','m3u8']),choices('redirect_stream','Redirect to media',['','false','true'])],'M3U8 output provides a directly playable playlist of stable Worker permalinks. Every playback resolves the source again.','GET',true),
 op('detect','Detect host','/mcp/tools/auto_detect_host',[destination]),
 op('hosts','Supported hosts','/mcp/tools/list_supported_hosts') ]},
 {id:'player',label:'Media player',description:'Play a direct media link or generated proxy URL.'},
 {id:'playlist',label:'Playlist builder',description:'Create and download your own channel playlist.'},
 {id:'xtream',label:'Xtream Codes',description:'Inspect compatibility endpoints. Backend data is currently sample or empty.',operations:[
 op('xc-api','Player API','/player_api.php',[field('username','Username'),field('password','Password',{type:'password'}),choices('action','Action',['','get_live_categories','get_live_streams','get_vod_categories','get_vod_streams','get_series_categories','get_series','get_series_info','get_short_epg','get_simple_data_table']),field('category_id','Category ID'),field('series_id','Series ID'),field('stream_id','Stream ID'),field('limit','EPG limit',{type:'number',min:1})]),
 op('xc-m3u','Export M3U','/get.php',[field('username','Username'),field('password','Password',{type:'password'}),choices('type','Content type',['live','vod','series']),field('category_id','Category ID')]),
 op('xc-epg','Export XMLTV','/xmltv.php',[field('username','Username'),field('password','Password',{type:'password'})]),
 op('xc-stream','Short stream URL','/{username}/{password}/{stream_id}.{extension}',[field('username','Username',{required:true}),field('password','Password',{type:'password',required:true}),field('stream_id','Numeric stream ID',{required:true,type:'number',min:0}),choices('extension','Extension',['ts','mp4','m3u8'])],'No stream IDs are configured in this backend yet; requests currently return HTTP 404.','GET',true) ]},
 {id:'utilities',label:'Utilities',description:'Encode URLs, inspect status and view metrics.',operations:[
 op('encode','Base64 encode','/base64/encode',[destination],'Encode a URL.','POST'),
 op('decode','Base64 decode','/base64/decode',[destination],'Decode a Base64 URL.','POST'),
 op('check','Base64 check','/base64/check',[destination]),
 op('health','Health check','/health'),op('ip','IP information','/proxy/ip'),op('metrics','Prometheus metrics','/metrics') ]},
 {id:'speed',label:'Speed test',description:'Measure throughput through your proxy.'},
 {id:'mcp',label:'MCP explorer',description:'Discover tools, resources and prompts.',operations:[
 op('mcp','Discovery','/mcp'),op('resources','Resources','/mcp/resources'),op('prompts','Prompts','/mcp/prompts/list'),
 op('resource','Read resource','/mcp/resources/read',[choices('uri','Resource',['mediaflow://supported-hosts','mediaflow://health','mediaflow://metrics'])]),
 op('execute','Execute MCP tool','/mcp/execute',[field('tool','Tool name',{required:true,list:'tools'}),field('d','Destination / input'),field('host','Extractor host',{list:'hosts'}),choices('redirect_stream','Redirect to media',['','false','true'])],'Select a tool discovered from this Worker. Extra parameters can be entered below.') ]}
];
let current, controller, speedController, responseText='', responseType='text/plain', playlist='', mcpTools=[];
const allOps = groups.flatMap(g=>g.operations||[]);
function notify(text,error=false){$('feedback').textContent=text;$('feedback').className=error?'error':'ok';}
function addOption(select,value,label){const option=document.createElement('option');option.value=value;option.textContent=label||value;select.append(option);}
function navigate(id){if(location.hash==='#'+id)selectGroup(id);else location.hash=id;}
function selectGroup(id){
 const group=groups.find(g=>g.id===id)||groups[0];
 if(controller)controller.abort();
 document.querySelectorAll('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.group===group.id?'page':'false'));
 $('title').textContent=group.label;$('subtitle').textContent=group.description;
 ['overview','workspace','player-section','playlist-section','speed-section'].forEach(key=>$(key).hidden=true);
 $('feedback').textContent='';
 if(group.operations){$('workspace').hidden=false;$('operation').replaceChildren();group.operations.forEach(o=>addOption($('operation'),o.id,o.label));selectOperation();}
 else $(group.id==='overview'?'overview':group.id+'-section').hidden=false;
}
function selectOperation(){
 current=allOps.find(o=>o.id===$('operation').value);$('description').textContent=current.description;$('fields').replaceChildren();
 current.fields.forEach(f=>{const wrap=document.createElement('div'),label=document.createElement('label');label.htmlFor='f-'+f.name;label.textContent=f.label;const input=document.createElement(f.values?'select':'input');input.id='f-'+f.name;input.name=f.name;if(f.values)f.values.forEach(v=>addOption(input,v,v||'Default / automatic'));else input.type=f.type||'text';input.required=!!f.required;if(f.min!==undefined)input.min=f.min;if(f.list)input.setAttribute('list',f.list);input.autocomplete='off';wrap.append(label,input);$('fields').append(wrap);});
 $('extra').value='';$('url-card').hidden=true;$('result-card').hidden=true;
}
function buildRequest(){
 if(!$('tool-form').reportValidity())return null;
 const params=new URLSearchParams();new FormData($('tool-form')).forEach((v,k)=>{if(String(v).trim())params.set(k,String(v).trim());});
 $('extra').value.split('\n').filter(l=>l.trim()).forEach(line=>{const eq=line.indexOf('=');if(eq<1)throw new Error('Extra parameters must use key=value.');params.set(line.slice(0,eq).trim(),line.slice(eq+1).trim());});
 let endpoint=current.path,method=current.method;
 if(current.id==='execute'){
   const name=params.get('tool'),tool=mcpTools.find(t=>t.name===name);
   if(!tool)throw new Error('Choose a tool from the discovered tool list.');
   if(!['list_supported_hosts','auto_detect_host','health_check','get_metrics','video_extractor_redirect'].includes(name)){
     endpoint=tool.endpoint;method=tool.method||'GET';params.delete('tool');
     if(endpoint==='/extractor/video'&&name==='video_extractor')params.delete('redirect_stream');
   }
 }
 let path=endpoint.replace(/\{([^}]+)\}/g,(_,key)=>{const value=params.get(key);if(!value)throw new Error('Missing '+key);params.delete(key);return encodeURIComponent(value);});
 const url=new URL(path,location.origin);if($('api-password').value)url.searchParams.set('api_password',$('api-password').value);
 let body; if(method==='POST'){body=JSON.stringify(Object.fromEntries(params));}else params.forEach((v,k)=>url.searchParams.set(k,v));
 return {url,method,body};
}
function showUrl(request){$('url-card').hidden=false;$('request-url').value=request.url.href;$('open-url').href=request.url.href;$('open-url').hidden=request.method!=='GET';$('play-url').hidden=!current.media||(current.id==='multi'&&request.url.searchParams.get('output_format')!=='m3u8'&&request.url.searchParams.get('redirect_stream')!=='true');$('copy-url').disabled=request.method!=='GET';if(request.method!=='GET')notify('This endpoint requires POST with a JSON body; use Run request.');}
function streamActions(data){
 $('stream-actions').replaceChildren();let count=0;
 function visit(value){if(!value||typeof value!=='object'||count>=20)return;if(Array.isArray(value)){value.slice(0,20).forEach(visit);return;}
  if(typeof value.stream_url==='string'){
   try{
    const source=value.redirect_url||value.original_url||data.original_url||new URL($('request-url').value).searchParams.get('d');
    if(!source)return;
    const url=value.permalink_url?new URL(value.permalink_url,location.origin):new URL('/resolve_redirect/extract',location.origin);
    if(url.origin!==location.origin)return;
    if(!value.permalink_url){url.searchParams.set('d',source);url.searchParams.set('play','true');url.searchParams.set('output_format','m3u8');const request=new URL($('request-url').value);request.searchParams.forEach((val,key)=>{if(key.startsWith('h_'))url.searchParams.set(key,val);});}
    if($('api-password').value)url.searchParams.set('api_password',$('api-password').value);count++;
    const button=document.createElement('button');button.textContent='Play stream '+count;button.onclick=()=>{selectGroup('player');location.hash='player';play(url.href);};
    const link=document.createElement('a');link.className='button';link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open stream '+count;
    const copyButton=document.createElement('button');copyButton.textContent='Copy stream '+count;copyButton.onclick=()=>copy(url.href);$('stream-actions').append(button,link,copyButton);
   }catch{}}
  Object.values(value).filter(v=>v&&typeof v==='object').forEach(visit);
 }
 visit(data);
}
async function readPreview(response){
 const reader=response.body&&response.body.getReader();if(!reader)return '';const decoder=new TextDecoder();let bytes=0,text='',truncated=false;
 try{while(true){const part=await reader.read();if(part.done)break;const remaining=262144-bytes;text+=decoder.decode(part.value.subarray(0,remaining),{stream:true});bytes+=part.value.length;if(bytes>=262144){truncated=true;break;}}text+=decoder.decode();}finally{await reader.cancel();}
 return text+(truncated?'\n\n[Preview limited to 256 KiB. Open the URL to stream or download the full response.]':'');
}
async function runRequest(event){
 event.preventDefault();try{const request=buildRequest();if(!request)return;showUrl(request);if(controller)controller.abort();const active=new AbortController();controller=active;$('cancel').disabled=false;$('result-card').hidden=false;$('response-status').textContent='Loading…';$('result').textContent='';$('stream-actions').replaceChildren();responseText='';
 const timer=setTimeout(()=>active.abort(),30000);
 try{const start=performance.now();const response=await fetch(request.url,{method:request.method,body:request.body,headers:request.body?{'Content-Type':'application/json'}:{},signal:active.signal});responseType=response.headers.get('content-type')||'text/plain';
 if(/^(video|audio)\//.test(responseType)&&!/(mpegurl|m3u)/i.test(responseType)){if(response.body)await response.body.cancel();responseText='Media response received. Use Play or Open to stream it without buffering the file in the dashboard.';}
 else{responseText=await readPreview(response);try{const data=JSON.parse(responseText);responseText=JSON.stringify(data,null,2);streamActions(data);}catch{}}
 $('response-status').textContent='HTTP '+response.status+' · '+Math.round(performance.now()-start)+' ms';$('response-status').className=response.ok?'ok':'error';$('result').textContent=responseText;
 }catch(error){$('response-status').textContent='Request failed';$('response-status').className='error';$('result').textContent=error.name==='AbortError'?'Request cancelled or timed out after 30 seconds.':error.message;}
 finally{clearTimeout(timer);if(controller===active){controller=null;$('cancel').disabled=true;}}
 }catch(error){notify(error.message,true);}
}
async function copy(text){try{await navigator.clipboard.writeText(text);notify('Copied to clipboard.');}catch{notify('Clipboard unavailable. Select and copy the text manually.',true);}}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function play(url){try{const parsed=new URL(url,location.origin);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Use an HTTP or HTTPS media URL.');$('media-url').value=parsed.href;$('player').src=parsed.href;$('player').load();$('player-status').textContent='Media loaded. Press play to start.';}catch(error){$('player-status').textContent=error.message;}}
async function refresh(){
 const results=await Promise.allSettled([fetch('/health').then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}),fetch('/mcp').then(r=>r.json()),fetch('/mcp/tools/list_supported_hosts').then(r=>r.json())]);
 if(results[0].status==='fulfilled'&&results[0].value.status==='ok'){$('health').textContent='● Online';$('version').textContent=results[0].value.version;$('service-detail').textContent='Health check passed';}else{$('health').textContent='Offline / unavailable';$('service-detail').textContent='Health check failed';}
 if(results[1].status==='fulfilled'){const tools=results[1].value.tools||[];mcpTools=tools;$('tool-count').textContent=tools.length;const list=$('tools');list.replaceChildren();tools.forEach(t=>addOption(list,t.name));}
 if(results[2].status==='fulfilled'){const hosts=results[2].value.hosts||results[2].value.supported_hosts||[];$('host-count').textContent=hosts.length;const list=$('hosts');list.replaceChildren();hosts.forEach(h=>addOption(list,h));}
}
groups.forEach(g=>{const button=document.createElement('button');button.type='button';button.textContent=g.label;button.dataset.group=g.id;button.onclick=()=>navigate(g.id);$('nav').append(button);if(g.id!=='overview'){const tile=document.createElement('button');tile.className='tile';const title=document.createElement('strong'),description=document.createElement('span');title.textContent=g.label;description.textContent=g.description;tile.append(title,description);tile.onclick=()=>navigate(g.id);$('tiles').append(tile);}});
['hosts','tools'].forEach(id=>{const list=document.createElement('datalist');list.id=id;document.body.append(list);});
$('operation').onchange=selectOperation;$('tool-form').onsubmit=runRequest;$('cancel').onclick=()=>controller&&controller.abort();
$('generate').onclick=()=>{try{const request=buildRequest();if(request)showUrl(request);}catch(error){notify(error.message,true);}};
$('copy-url').onclick=()=>copy($('request-url').value);$('copy-result').onclick=()=>copy(responseText);$('download-result').onclick=()=>{const ext=/json/i.test(responseType)?'json':/xml/i.test(responseType)?'xml':/(mpegurl|m3u)/i.test(responseType)?'m3u8':'txt';download(responseText,'mediaflow-response.'+ext,responseType);};
$('play-url').onclick=()=>{const url=$('request-url').value;location.hash='player';selectGroup('player');play(url);};
$('load-media').onclick=()=>play($('media-url').value);$('stop-media').onclick=()=>{$('player').pause();$('player').removeAttribute('src');$('player').load();$('player-status').textContent='Stopped.';};$('player').onerror=()=>{$('player-status').textContent='Playback failed. The URL may be unavailable or its format unsupported by this browser. Try the generated URL in VLC.';};
$('clear-password').onclick=()=>{$('api-password').value='';$('request-url').value='';$('url-card').hidden=true;notify('API password cleared.');};$('refresh').onclick=refresh;
$('build-playlist').onclick=()=>{try{const lines=$('channels').value.split('\n').filter(line=>line.trim());if(!lines.length)throw new Error('Enter at least one channel.');let output='#EXTM3U\n';lines.forEach((line,i)=>{const [name,url,group,logo]=line.split('|').map(s=>s.trim());if(!name||!url)throw new Error('Line '+(i+1)+': enter name|url.');const destination=new URL(url);if(!['http:','https:'].includes(destination.protocol))throw new Error('Line '+(i+1)+': use HTTP or HTTPS.');let media=destination.href;if($('proxy-playlist').checked){const proxy=new URL('/proxy/stream',location.origin);proxy.searchParams.set('d',media);if($('api-password').value)proxy.searchParams.set('api_password',$('api-password').value);media=proxy.href;}const clean=v=>v.replace(/["\r\n]/g,'');output+='#EXTINF:-1'+(group?' group-title="'+clean(group)+'"':'')+(logo?' tvg-logo="'+clean(logo)+'"':'')+','+clean(name)+'\n'+media+'\n';});playlist=output;$('playlist-output').textContent=playlist;$('save-playlist').disabled=false;$('copy-playlist').disabled=false;notify(lines.length+' channels added.');}catch(error){playlist='';$('save-playlist').disabled=true;$('copy-playlist').disabled=true;notify(error.message,true);}};
$('save-playlist').onclick=()=>download(playlist,'playlist.m3u','audio/x-mpegurl');$('copy-playlist').onclick=()=>copy(playlist);
$('run-speed').onclick=async()=>{const active=new AbortController();speedController=active;$('run-speed').disabled=true;$('cancel-speed').disabled=false;const timer=setTimeout(()=>active.abort(),60000);let total=0;const size=Number($('test-size').value),start=performance.now();try{const url=new URL('/proxy/stream',location.origin);url.searchParams.set('d','https://speed.cloudflare.com/__down?bytes='+size);if($('api-password').value)url.searchParams.set('api_password',$('api-password').value);const response=await fetch(url,{signal:active.signal,cache:'no-store'});if(!response.ok)throw new Error('HTTP '+response.status);const reader=response.body.getReader();while(true){const part=await reader.read();if(part.done)break;total+=part.value.length;$('speed-output').textContent='Downloaded '+(total/1000000).toFixed(2)+' / '+(size/1000000)+' MB';}if(total!==size)throw new Error('Expected '+size+' bytes, received '+total+'.');const seconds=(performance.now()-start)/1000;$('speed-output').textContent=(total/1000000).toFixed(2)+' MB in '+seconds.toFixed(2)+' s\n'+(total*8/1000000/seconds).toFixed(2)+' Mbps';}catch(error){$('speed-output').textContent=error.name==='AbortError'?'Test cancelled or timed out.':error.message;}finally{clearTimeout(timer);speedController=null;$('run-speed').disabled=false;$('cancel-speed').disabled=true;}};
$('cancel-speed').onclick=()=>speedController&&speedController.abort();
window.addEventListener('hashchange',()=>selectGroup(location.hash.slice(1)));selectGroup(location.hash.slice(1));refresh();
</script></body></html>`;
