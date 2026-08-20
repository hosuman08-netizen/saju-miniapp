/* p10 fictional credits rail — 5H DNA (virtual only) */
(function(){
  try{
    var K='p10_balance';
    if(localStorage.getItem(K)==null) localStorage.setItem(K,'100');
    window.p10Bal=function(){return +(localStorage.getItem(K)||0);};
    window.p10Skim=function(n){n=n||1;var b=window.p10Bal()-n;if(b<0)b=0;localStorage.setItem(K,String(b));return b;};
    window.p10Grant=function(n){n=n||1;var b=window.p10Bal()+n;localStorage.setItem(K,String(b));return b;};
  }catch(e){}
})();
