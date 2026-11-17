const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
async function verify(initData,token){
 const p=new URLSearchParams(initData||''),hash=p.get('hash'),auth=Number(p.get('auth_date'));
 if(!hash||!auth||Math.abs(Date.now()/1000-auth)>3600)return null;
 p.delete('hash');const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const enc=new TextEncoder(),k=await crypto.subtle.importKey('raw',enc.encode('WebAppData'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const secret=await crypto.subtle.sign('HMAC',k,enc.encode(token));
 const derived=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=await crypto.subtle.sign('HMAC',derived,enc.encode(check));
 if([...new Uint8Array(signature)].map(x=>x.toString(16).padStart(2,'0')).join('')!==hash)return null;
 try{return JSON.parse(p.get('user')||'null')}catch{return null}
}
export async function onRequestPost({request,env}){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_ADMIN_CHAT_ID)return json({error:'Переменные бота не настроены'},503);
 let data;try{data=await request.json()}catch{return json({error:'Неверный запрос'},400)}
 const user=await verify(data?.initData,env.TELEGRAM_BOT_TOKEN);
 if(!user||String(user.id)!==String(env.TELEGRAM_ADMIN_CHAT_ID))return json({error:'Настройка доступна только владельцу через Telegram'},403);
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ozhivaet-webhook:'+env.TELEGRAM_BOT_TOKEN));
 const secret=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const url=new URL(request.url);const webhookUrl=url.origin+'/api/telegram-webhook';
 const res=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/setWebhook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:webhookUrl,secret_token:secret,allowed_updates:['callback_query','message'],drop_pending_updates:false})});
 const result=await res.json();if(!result.ok)return json({error:'Telegram не принял настройку: '+String(result.description||'')},502);
 const menu=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/setChatMenuButton',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({menu_button:{type:'web_app',text:'📖 Открыть библиотеку',web_app:{url:url.origin}}})});
 const menuResult=await menu.json();
 const commands=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/setMyCommands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({commands:[{command:'start',description:'✨ Главное меню библиотеки'},{command:'menu',description:'📖 Выбрать сказку'},{command:'help',description:'💬 Как заказать и помощь'}]})});
 const commandsResult=await commands.json();
 const profile=[
  ['setMyName',{name:'Люми ✨ Волшебная библиотека',language_code:'ru'}],
  ['setMyDescription',{description:'✨ Добро пожаловать в Волшебную библиотеку Люми! Здесь ваш ребёнок становится главным героем персональной иллюстрированной сказки. 📖 Выбирайте историю, загружайте фотографии, оформляйте заказ и следите за его готовностью. 💌 По любому вопросу можно написать прямо сюда.',language_code:'ru'}],
  ['setMyShortDescription',{short_description:'📖 Персональные сказки с вашим ребёнком в главной роли ✨',language_code:'ru'}]
 ];
 const profileResults={};
 for(const [method,payload] of profile){try{const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();profileResults[method]=!!result.ok}catch{profileResults[method]=false}}

 return json({ok:true,menuConfigured:!!menuResult.ok,commandsConfigured:!!commandsResult.ok,profileConfigured:Object.values(profileResults).every(Boolean),profileResults,botUsername:(await (await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/getMe')).json()).result?.username||null});
}
export async function onRequestGet(){return new Response('Method Not Allowed',{status:405})}
