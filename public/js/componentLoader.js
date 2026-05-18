export async function loadComponents() {
  const components = [
    'authPage', 'mainMenu', 'fullOptions', 'partOptions',
    'fullForm', 'partForm', 'fullFormCustom', 'partFormCustom',
    'tapToSyncPage', 'videoPreview', 'gallery', 'feedbackPage',
    'shareModal', 'imagePickerOverlay', 'toastNotification'
  ];
  
  const promises = components.map(async (id) => {
    const res = await fetch(`/components/${id}.html`);
    const compHtml = await res.text();
    return { id, html: compHtml };
  });
  
  const results = await Promise.all(promises);
  const iterator = document.createNodeIterator(document.body, NodeFilter.SHOW_COMMENT, null, false);
  let currentNode;
  const replacements = [];
  while (currentNode = iterator.nextNode()) {
    const match = currentNode.nodeValue.match(/COMPONENT:\s*(.+)/);
    if (match) {
      const id = match[1].trim();
      const comp = results.find(r => r.id === id);
      if (comp) {
        replacements.push({ node: currentNode, html: comp.html });
      }
    }
  }
  
  replacements.forEach(({ node, html }) => {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    node.parentNode.replaceChild(template.content, node);
  });
  
  console.log("Components loaded.");
}