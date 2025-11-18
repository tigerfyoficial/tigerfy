// Fecha menus flutuantes ao clicar fora
document.addEventListener('click', (e)=>{
  const menu = document.getElementById('offerActionsMenu');
  if (!menu || menu.hidden) return;
  if (!e.target.closest('#offerActionsMenu') && !e.target.closest('.offer-actions-inline')) {
    menu.hidden = true;
  }
}, true);

// Garante overlay acima de tudo (caso seu CSS antigo ainda injete algo)
const confirmHost = document.getElementById('tfConfirmOverlay');
if (confirmHost) confirmHost.style.zIndex = '1300';
