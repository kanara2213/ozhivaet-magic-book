const labels={accepted:'✅ Принят',paid:'💳 Оплачен',working:'🎨 В работе',ready:'📖 Готов'};
const messages={accepted:'Ваша заявка принята! Мы свяжемся с вами для согласования деталей и оплаты.',paid:'Оплата вашего заказа подтверждена. Спасибо! Скоро начнём создавать сказку.',working:'Ваша персональная сказка уже в работе! ✨',ready:'Ваша сказка готова! Мы скоро отправим вам PDF-книгу. 📖'};
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json'}});
async function secretFor(token){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ozhivaet-webhook:'+token));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function tg(token,method,payload){const res=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});return res.json()}
export async function onRequestPost({request,env}){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_ADMIN_CHAT_ID)return json({ok:false},503);
 const secret=await secretFor(env.TELEGRAM_BOT_TOKEN);
 if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==secret)return json({ok:false},403);
 let body;try{body=await request.json()}catch{return json({ok:false},400)}
 const msg=body?.message;
 if(msg&&String(msg.chat?.type)==='private'){
  const input=String(msg.text||'').trim();
  const url=new URL(request.url).origin;
  const keyboard={keyboard:[[{text:'📖 Открыть библиотеку',web_app:{url}}],[{text:'✨ Как заказать'},{text:'💰 Цены и форматы'}],[{text:'💬 Помощь'}]],resize_keyboard:true,is_persistent:true};
  let answer='';
  if(/^\/(start|menu|help)(?:@\w+)?(?:\s|$)/i.test(input)||input==='🏠 Меню'){
   answer='✨ Добро пожаловать в Волшебную библиотеку Люми!\n\nЗдесь ваш ребёнок станет главным героем персональной иллюстрированной сказки.\n\n📖 Нажмите «Открыть библиотеку» внизу экрана, чтобы выбрать историю, полистать пример книги Лизы и оформить заказ.\n\nНе нужно вводить команды — все разделы доступны кнопками.';
  }else if(input==='✨ Как заказать'){
   answer='✨ Как заказать сказку\n\n1. Нажмите «📖 Открыть библиотеку».\n2. Выберите коллекцию, историю и тариф.\n3. Заполните анкету ребёнка и отправьте заявку.\n4. Мы согласуем детали и оплату, а после подтверждения оплаты приступим к созданию книги.\n\nПример готовой сказки Лизы можно полистать в библиотеке.';
  }else if(input==='💰 Цены и форматы'){
   answer='💰 Наши тарифы\n\n🌱 Мини-история — 500 ₽\n✨ Моя сказка — 1 490 ₽\n👑 Книга чудес — 2 990 ₽\n\nПодробности и выбор тарифа — в библиотеке. Оплата согласовывается после заявки.';
  }else if(input==='💬 Помощь'){
   answer='💬 Нужна помощь с выбором или заказом?\n\nПо вопросам заказа обратитесь к менеджеру студии через контакты в приложении. Если заказ уже оформлен, укажите его номер.\n\nДля выбора сказки нажмите «📖 Открыть библиотеку».';
  }else if(input&&!input.startsWith('/')){
   answer='Спасибо за сообщение! 💛 Для выбора сказки используйте кнопку «📖 Открыть библиотеку». Если вам нужна помощь, нажмите «💬 Помощь».';
  }
  if(answer){await tg(env.TELEGRAM_BOT_TOKEN,'sendMessage',{chat_id:msg.chat.id,text:answer,reply_markup:keyboard});return json({ok:true})}
 }
 const cb=body?.callback_query;
 if(!cb)return json({ok:true});
 const parts=String(cb.data||'').split(':');
 const [prefix,status,customerId]=parts;
 const admin=String(env.TELEGRAM_ADMIN_CHAT_ID);
 if(prefix!=='order'||!labels[status]||!/^[0-9]{1,20}$/.test(customerId||'')||String(cb.from?.id)!==admin||String(cb.message?.chat?.id)!==admin){
  await tg(env.TELEGRAM_BOT_TOKEN,'answerCallbackQuery',{callback_query_id:cb.id,text:'Нет доступа к управлению заказом',show_alert:true});return json({ok:true})
 }
 const previous=String(cb.message?.text||'');
 const withoutStatus=previous.replace(/\n\n📌 Статус:.*$/s,'');
 const text=withoutStatus+'\n\n📌 Статус: '+labels[status];
 const keyboard={inline_keyboard:[[{text:'✅ Принять',callback_data:'order:accepted:'+customerId},{text:'💳 Оплачен',callback_data:'order:paid:'+customerId}],[{text:'🎨 В работе',callback_data:'order:working:'+customerId},{text:'📖 Готов',callback_data:'order:ready:'+customerId}]]};
 const edited=await tg(env.TELEGRAM_BOT_TOKEN,'editMessageText',{chat_id:admin,message_id:cb.message.message_id,text,reply_markup:keyboard});
 if(!edited.ok){await tg(env.TELEGRAM_BOT_TOKEN,'answerCallbackQuery',{callback_query_id:cb.id,text:'Не удалось изменить статус',show_alert:true});return json({ok:true})}
 let notice='';if(status==='accepted'||status==='paid'||status==='working'||status==='ready'){const sent=await tg(env.TELEGRAM_BOT_TOKEN,'sendMessage',{chat_id:customerId,text:'📚 OZHIVAET — Волшебная библиотека\n\n'+messages[status]});if(!sent.ok)notice=' (клиенту не доставлено)'}
 await tg(env.TELEGRAM_BOT_TOKEN,'answerCallbackQuery',{callback_query_id:cb.id,text:'Статус: '+labels[status]+notice,show_alert:!!notice});
 return json({ok:true});
}
export async function onRequestGet(){return new Response('Method Not Allowed',{status:405})}
