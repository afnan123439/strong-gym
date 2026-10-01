(function(){
  const seen=new Set();
  function clean(value,max=500){return String(value||'').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email]').replace(/(?:\+?\d[\d\s-]{7,}\d)/g,'[phone]').slice(0,max)}
  async function report(kind,message,source,line,column){
    if(!window.StrongGymAPI?.logClientError)return;
    const key=`${kind}:${message}:${source}:${line}`;
    if(seen.has(key))return;
    seen.add(key);
    try{await StrongGymAPI.logClientError({kind, message:clean(message), source:clean(source,240), line:Number(line)||null, column_number:Number(column)||null, path:location.pathname.slice(0,160), user_agent:navigator.userAgent.slice(0,300)})}catch{}
  }
  window.addEventListener('error',event=>report('javascript',event.message,event.filename,event.lineno,event.colno));
  window.addEventListener('unhandledrejection',event=>report('promise',event.reason?.message||event.reason||'Unhandled promise rejection','',null,null));
})();
