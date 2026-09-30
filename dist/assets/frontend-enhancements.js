(()=>{
  const isMember=location.pathname.toLowerCase().includes('member');
  document.documentElement.classList.add('enhanced-ui');
  const loader=document.createElement('div');
  loader.className='app-loader';
  loader.innerHTML='<div class="loader-mark"><img src="assets/app-icon.svg" alt=""><i></i></div><b>STRONG GYM</b><span>نجهّز حسابك وخطتك…</span>';
  document.body.append(loader);
  const hideLoader=()=>{if(!loader.isConnected)return;loader.classList.add('done');setTimeout(()=>loader.remove(),450)};
  const readyCheck=setInterval(()=>{
    const pending=document.querySelector('#memberSubscription .badge')?.textContent?.includes('جاري التحميل');
    const adminLoading=document.querySelector('#todayLabel')?.textContent?.includes('جاري تحميل');
    if((isMember&&!pending)||(!isMember&&!adminLoading)){clearInterval(readyCheck);hideLoader()}
  },160);
  setTimeout(()=>{clearInterval(readyCheck);hideLoader()},5000);
  if(!isMember)return;
  const modal=document.createElement('div');
  modal.className='exercise-detail';modal.hidden=true;
  modal.innerHTML='<button type="button" class="exercise-detail-close" aria-label="إغلاق">×</button><div class="exercise-detail-card"><div class="exercise-detail-visual"><i class="exercise-thumb"></i></div><div><span>EXERCISE GUIDE</span><h2></h2><p>ابدأ بوزن يسمح لك بإكمال التكرارات بأداء ثابت. حافظ على التنفس والحركة المتحكّم بها، وأوقف التمرين عند الشعور بألم غير طبيعي.</p><small>اضغط «حفظ الإنجاز» بعد الانتهاء ليتم تحديث هدف الجلسة القادمة تلقائيًا.</small></div></div>';
  document.body.append(modal);
  const close=()=>{modal.hidden=true;document.body.classList.remove('modal-open')};
  modal.querySelector('.exercise-detail-close').onclick=close;modal.onclick=e=>{if(e.target===modal)close()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('click',e=>{const item=e.target.closest('.exercise-item');if(!item)return;const source=item.querySelector('.exercise-thumb'),copy=item.cloneNode(true);copy.querySelector('em')?.remove();modal.querySelector('h2').textContent=copy.textContent.trim();modal.querySelector('.exercise-thumb').style.cssText=source?.style.cssText||'';modal.hidden=false;document.body.classList.add('modal-open')});
  const navLinks=[...document.querySelectorAll('.bottom-nav a')],sections=navLinks.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const observer=new IntersectionObserver(entries=>{const current=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!current)return;navLinks.forEach(link=>link.classList.toggle('active',link.getAttribute('href')===`#${current.target.id}`))},{rootMargin:'-25% 0px -60%',threshold:[0,.15,.5]});
  sections.forEach(section=>observer.observe(section));
})();
