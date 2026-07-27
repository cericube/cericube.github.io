(function () {
  const groups = document.querySelectorAll('.tree-group');
  const currentPost = document.querySelector('.tree-post-link.is-current');
  const activeChild = document.querySelector('.tree-child.is-active');

  function openGroup(group) {
    if (!group) return;
    const button = group.querySelector('.tree-parent');
    group.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
  }

  groups.forEach((group) => {
    const button = group.querySelector('.tree-parent');
    button.addEventListener('click', () => {
      const open = group.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  if (currentPost) {
    openGroup(currentPost.closest('.tree-group'));
    currentPost.closest('.tree-child')?.classList.add('is-active');
  } else if (activeChild) {
    openGroup(activeChild.closest('.tree-group'));
  } else {
    openGroup(document.querySelector('.tree-group'));
  }

  const categoryTree = document.querySelector('.category-tree');
  const categoryScrollKey = 'categoryTreeScrollTop';

  if (categoryTree) {
    const savedScrollTop = sessionStorage.getItem(categoryScrollKey);

    if (savedScrollTop !== null) {
      requestAnimationFrame(() => {
        categoryTree.scrollTop = Number(savedScrollTop);
      });
    }

    categoryTree.addEventListener('scroll', () => {
      sessionStorage.setItem(categoryScrollKey, String(categoryTree.scrollTop));
    }, { passive: true });
  }

  const postList = document.getElementById('postList');
  if (!postList) return;

  const cards = Array.from(postList.querySelectorAll('.post-card'));
  const title = document.getElementById('listTitle');
  const count = document.getElementById('postCount');
  const empty = document.getElementById('emptyMessage');
  const sort = document.getElementById('sortPosts');
  const categoryLinks = document.querySelectorAll('[data-filter]');

  const params = new URLSearchParams(window.location.search);
  let selected = params.get('category') || 'all';

  function categoryName(id) {
    if (id === 'all') return '전체 글 목록';
    const link = document.querySelector(`.category-link[data-filter="${id}"]`);
    return link ? link.textContent.replace(/\(\d+\)/, '').trim() : '전체 글 목록';
  }

  function render() {
    let visible = cards.filter((card) => selected === 'all' || card.dataset.category === selected);
    const direction = sort.value === 'oldest' ? 1 : -1;
    visible.sort((a, b) => (Number(a.dataset.date) - Number(b.dataset.date)) * direction);

    cards.forEach((card) => { card.hidden = true; });
    visible.forEach((card) => {
      card.hidden = false;
      postList.appendChild(card);
    });

    title.textContent = categoryName(selected);
    count.textContent = `(${visible.length})`;
    empty.hidden = visible.length !== 0;

    document.querySelectorAll('.tree-child').forEach((child) => child.classList.remove('is-active'));
    const active = document.querySelector(`.tree-child[data-category-id="${selected}"]`);
    if (active) {
      active.classList.add('is-active');
      openGroup(active.closest('.tree-group'));
    }
  }

  categoryLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!link.dataset.filter) return;
      event.preventDefault();
      selected = link.dataset.filter;
      const url = selected === 'all' ? location.pathname : `${location.pathname}?category=${selected}`;
      history.replaceState({}, '', url);
      render();
    });
  });

  sort.addEventListener('change', render);
  render();
})();
