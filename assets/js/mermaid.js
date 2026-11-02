const mermaidCodeBlocks = document.querySelectorAll('code.language-mermaid');

if (mermaidCodeBlocks.length > 0) {
  const { default: mermaid } = await import(
    'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'
  );

  mermaidCodeBlocks.forEach((codeBlock) => {
    const container = codeBlock.closest('.highlighter-rouge') || codeBlock.parentElement;
    const diagram = document.createElement('div');

    diagram.className = 'mermaid';
    diagram.textContent = codeBlock.textContent;
    container.replaceWith(diagram);
  });

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    themeVariables: {
      primaryColor: '#dbeafe',
      primaryBorderColor: '#3b82f6',
      primaryTextColor: '#111827',
      actorBkg: '#dbeafe',
      actorBorder: '#3b82f6',
      actorTextColor: '#111827',
      noteBkgColor: '#f8fafc',
      noteBorderColor: '#22c55e',
      noteTextColor: '#111827',
      signalColor: '#6b7280',
      signalTextColor: '#111827',
      lineColor: '#9ca3af',
    },
    sequence: {
      mirrorActors: true,
      useMaxWidth: true,
    },
  });

  await mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
}
