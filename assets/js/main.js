(function () {
  const sidebar = document.getElementById('sidebar');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const sidebarWidthKey = 'sidebarWidth';
  const sidebarMinWidth = 280;
  const contentMinWidth = 640;

  function sidebarMaxWidth() {
    return Math.max(sidebarMinWidth, Math.min(560, window.innerWidth - contentMinWidth));
  }

  function setSidebarWidth(width, persist) {
    const nextWidth = Math.min(sidebarMaxWidth(), Math.max(sidebarMinWidth, Math.round(width)));
    document.documentElement.style.setProperty('--sidebar-width', `${nextWidth}px`);

    if (sidebarResizer) {
      sidebarResizer.setAttribute('aria-valuenow', String(nextWidth));
      sidebarResizer.setAttribute('aria-valuemax', String(sidebarMaxWidth()));
      sidebarResizer.setAttribute('aria-valuetext', `${nextWidth}픽셀`);
    }

    if (persist) {
      localStorage.setItem(sidebarWidthKey, String(nextWidth));
    }
  }

  if (sidebar && sidebarResizer) {
    const savedWidth = Number(localStorage.getItem(sidebarWidthKey));
    const initialWidth = Number.isFinite(savedWidth) && savedWidth > 0
      ? savedWidth
      : sidebar.getBoundingClientRect().width;

    setSidebarWidth(initialWidth, false);

    sidebarResizer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;

      sidebarResizer.setPointerCapture(event.pointerId);
      document.body.classList.add('is-resizing');
    });

    sidebarResizer.addEventListener('pointermove', (event) => {
      if (!sidebarResizer.hasPointerCapture(event.pointerId)) return;
      setSidebarWidth(event.clientX, false);
    });

    function finishResize(event) {
      if (!sidebarResizer.hasPointerCapture(event.pointerId)) return;
      sidebarResizer.releasePointerCapture(event.pointerId);
      document.body.classList.remove('is-resizing');
      setSidebarWidth(event.clientX, true);
    }

    sidebarResizer.addEventListener('pointerup', finishResize);
    sidebarResizer.addEventListener('pointercancel', (event) => {
      if (!sidebarResizer.hasPointerCapture(event.pointerId)) return;
      sidebarResizer.releasePointerCapture(event.pointerId);
      document.body.classList.remove('is-resizing');
      setSidebarWidth(sidebar.getBoundingClientRect().width, true);
    });

    sidebarResizer.addEventListener('keydown', (event) => {
      const currentWidth = sidebar.getBoundingClientRect().width;
      const step = event.shiftKey ? 40 : 10;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSidebarWidth(currentWidth - step, true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSidebarWidth(currentWidth + step, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setSidebarWidth(sidebarMinWidth, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        setSidebarWidth(sidebarMaxWidth(), true);
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) {
        setSidebarWidth(sidebar.getBoundingClientRect().width, false);
      }
    });
  }

  const groups = document.querySelectorAll('.tree-group');
  const categoryLinks = document.querySelectorAll('[data-filter]');
  const treeStateKey = 'categoryTreeState:v1';

  function setChildOpen(child, open) {
    if (!child) return;
    const posts = child.querySelector('.tree-posts');
    if (!posts) return;

    const link = child.querySelector('.category-link');
    child.classList.toggle('is-open', open);
    link.setAttribute('aria-expanded', String(open));
  }

  function saveTreeState() {
    const openGroups = Array.from(groups)
      .filter((group) => group.classList.contains('is-open'))
      .map((group) => group.dataset.treeGroup);
    const openChildren = Array.from(document.querySelectorAll('.tree-child.is-open'))
      .map((child) => child.dataset.categoryId);

    sessionStorage.setItem(treeStateKey, JSON.stringify({
      openGroups,
      openChildren,
    }));
  }

  function restoreTreeState() {
    const savedState = sessionStorage.getItem(treeStateKey);
    if (!savedState) return;

    try {
      const state = JSON.parse(savedState);
      if (!Array.isArray(state.openGroups) || !Array.isArray(state.openChildren)) {
        throw new TypeError('Invalid category tree state');
      }

      const openGroups = new Set(state.openGroups);
      const openChildren = new Set(state.openChildren);

      groups.forEach((group) => {
        const open = openGroups.has(group.dataset.treeGroup);
        const button = group.querySelector('.tree-parent');
        group.classList.toggle('is-open', open);
        button.setAttribute('aria-expanded', String(open));
      });

      document.querySelectorAll('.tree-child').forEach((child) => {
        setChildOpen(child, openChildren.has(child.dataset.categoryId));
      });
    } catch (error) {
      sessionStorage.removeItem(treeStateKey);
    }
  }

  function toggleChild(child) {
    setChildOpen(child, !child.classList.contains('is-open'));
    saveTreeState();
  }

  groups.forEach((group) => {
    const button = group.querySelector('.tree-parent');
    button.addEventListener('click', () => {
      const open = group.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
      saveTreeState();
    });
  });

  restoreTreeState();

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

  const codeBlocks = document.querySelectorAll('.post-content pre');
  const codeCollapseLineThreshold = 24;

  codeBlocks.forEach((pre, index) => {
    const code = pre.querySelector('code');
    const source = (code || pre).textContent.replace(/\n$/, '');
    const lineCount = source ? source.split('\n').length : 0;

    if (lineCount <= codeCollapseLineThreshold) return;

    const block = pre.closest('.highlighter-rouge') || pre;
    const wrapper = document.createElement('div');
    const viewport = document.createElement('div');
    const toggle = document.createElement('button');
    const codeBlockId = `code-block-${index + 1}`;

    wrapper.className = 'code-collapse';
    viewport.className = 'code-collapse__viewport';
    toggle.className = 'code-collapse__toggle';
    toggle.type = 'button';
    toggle.textContent = `전체 코드 보기 (${lineCount}줄)`;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', codeBlockId);
    viewport.id = codeBlockId;

    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(viewport);
    viewport.appendChild(block);
    wrapper.appendChild(toggle);

    toggle.addEventListener('click', () => {
      const expanded = wrapper.classList.toggle('is-expanded');
      toggle.textContent = expanded ? '코드 접기' : `전체 코드 보기 (${lineCount}줄)`;
      toggle.setAttribute('aria-expanded', String(expanded));

      if (!expanded && wrapper.getBoundingClientRect().top < 0) {
        wrapper.scrollIntoView({ block: 'start' });
      }
    });
  });

  const postList = document.getElementById('postList');
  if (!postList) {
    categoryLinks.forEach((link) => {
      const child = link.closest('.tree-child');
      if (!child) return;

      link.addEventListener('click', (event) => {
        event.preventDefault();
        toggleChild(child);
      });
    });

    return;
  }

  const cards = Array.from(postList.querySelectorAll('.post-card'));
  const title = document.getElementById('listTitle');
  const count = document.getElementById('postCount');
  const empty = document.getElementById('emptyMessage');

  const params = new URLSearchParams(window.location.search);
  let selected = params.get('category') || 'all';

  function categoryName(id) {
    if (id === 'all') return '전체 글 목록';
    const link = document.querySelector(`.category-link[data-filter="${id}"]`);
    return link ? link.textContent.replace(/\(\d+\)/, '').trim() : '전체 글 목록';
  }

  function render() {
    const visible = cards.filter((card) => selected === 'all' || card.dataset.category === selected);

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
    }
  }

  categoryLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!link.dataset.filter) return;
      event.preventDefault();

      const child = link.closest('.tree-child');
      if (child) {
        toggleChild(child);
      }

      selected = link.dataset.filter;
      const url = selected === 'all' ? location.pathname : `${location.pathname}?category=${selected}`;
      history.replaceState({}, '', url);
      render();
    });
  });

  render();
})();
