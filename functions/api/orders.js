const TARIFFS=[{name:'Мини-история',price:500},{name:'Моя сказка',price:1490},{name:'Книга чудес',price:2990}];
const esc=s=>String(s??'').replace(/[<&>]/g,'').slice(0,500);
async function verifyTelegram(initData,token){
 if(!initData)return null;
 const params=new URLSearchParams(initData),hash=params.get('hash'),auth=Number(params.get('auth_date'));
 if(!hash||!auth||Math.abs(Date.now()/1000-auth)>86400)return null;
 params.delete('hash');const check=[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode('WebAppData'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const secret=await crypto.subtle.sign('HMAC',key,encoder.encode(token));
 const derived=await crypto.subtle.importKey('raw',secret,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',derived,encoder.encode(check));
 const actual=[...new Uint8Array(signed)].map(x=>x.toString(16).padStart(2,'0')).join('');
 if(actual!==hash)return null;
 try{return JSON.parse(params.get('user')||'null')}catch{return null}
}
export async function onRequestPost({request,env}){
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_ADMIN_CHAT_ID)return json({error:'Приём заявок настраивается. Пока используйте копирование заявки.'},503);
 if(Number(request.headers.get('content-length')||0)>12000)return json({error:'Слишком большая заявка'},413);
 let data;try{data=await request.json()}catch{return json({error:'Неверный формат заявки'},400)}
 const {childName,age,collection,story,occasion,details,guardian,tariff,illustrationStyle,initData}=data||{};
 if(!guardian||typeof childName!=='string'||!childName.trim()||childName.length>80||!Number.isInteger(age)||age<0||age>17||!Number.isInteger(tariff)||tariff<0||tariff>=TARIFFS.length||typeof collection!=='string'||collection.length>90||typeof story!=='string'||story.length>120||typeof details!=='string'||details.length>300||(illustrationStyle!==undefined&&(typeof illustrationStyle!=='string'||illustrationStyle.length>80)))return json({error:'Проверьте данные анкеты'},400);
 const user=await verifyTelegram(initData,env.TELEGRAM_BOT_TOKEN);
 if(!user?.id)return json({error:'Для автоматической отправки откройте библиотеку через Telegram-бота. В браузере можно скопировать заявку вручную.'},400);
 const id=new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomUUID().slice(0,8).toUpperCase();
 const t=TARIFFS[tariff];const lines=['📚 Новая заявка #'+id,'','👧 Ребёнок: '+esc(childName),'Возраст: '+age,'Коллекция: '+esc(collection),'История: '+esc(story),'Повод: '+esc(occasion),'Тариф: '+t.name,'Стиль: '+esc(illustrationStyle||'Не указан'),'Стоимость: '+t.price+' ₽','Пожелания: '+esc(details||'нет'),'','Telegram ID: '+user.id,'Клиент: '+esc(user.first_name||'')+(user.username?' (@'+esc(user.username)+')':''),'','⏳ Ожидает согласования и оплаты. Не начинать работу до оплаты.'];
 const res=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:env.TELEGRAM_ADMIN_CHAT_ID,text:lines.join('\n')})});
 if(!res.ok)return json({error:'Не удалось передать заявку. Попробуйте ещё раз или скопируйте её.'},502);
 return json({ok:true,orderId:id});
}
export async function onRequestGet(){return new Response('Method Not Allowed',{status:405})}
