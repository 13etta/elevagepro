(() => {
  const form=document.querySelector('[data-training-quote]');if(!form)return;
  const output=form.querySelector('[data-training-totals]');
  const euros=cents=>(cents/100).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
  function recap(){
    const total=Math.round(Number(form.elements.price.value)*100),deposit=Math.round(Number(form.elements.deposit.value)*100),rate=Number(form.elements.vat_rate.value);
    if(!form.elements.price.value||!form.elements.deposit.value||!Number.isFinite(total+deposit+rate)||deposit>total){output.textContent='';return;}
    const ht=Math.round(total/(1+rate/100));
    output.textContent=`Total HT : ${euros(ht)} · TVA : ${euros(total-ht)} · Acompte : ${euros(deposit)} · Solde après acompte : ${euros(total-deposit)}`;
  }
  form.addEventListener('input',recap);recap();
})();
