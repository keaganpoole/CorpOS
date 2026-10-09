export const makeTree = () => ({
  id: 'collection', name: 'Collection', children: [
    { id: 'alpha', name: 'Alpha', children: [{ id: 'a1', name: 'Element 01', children: [] }, { id: 'a2', name: 'Element 02', children: [] }, { id: 'a3', name: 'Element 03', children: [] }] },
    { id: 'beta', name: 'Beta', children: [{ id: 'b1', name: 'Element 04', children: [] }, { id: 'b2', name: 'Element 05', children: [] }] },
    { id: 'gamma', name: 'Gamma', children: [{ id: 'c1', name: 'Element 06', children: [] }, { id: 'c2', name: 'Element 07', children: [] }, { id: 'c3', name: 'Element 08', children: [] }, { id: 'c4', name: 'Element 09', children: [] }] },
    { id: 'delta', name: 'Delta', children: [{ id: 'd1', name: 'Element 10', children: [] }, { id: 'd2', name: 'Element 11', children: [] }] },
  ],
});
export const findNode = (tree, id) => tree.id === id ? tree : tree.children.reduce((found, child) => found || findNode(child, id), null);
export const appendChild = (tree, id, child) => tree.id === id ? { ...tree, children: [...tree.children, child] } : { ...tree, children: tree.children.map(node => appendChild(node, id, child)) };
export const countDescendants = (tree) => tree.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
export const pad = value => String(value).padStart(2, '0');
export const spring = { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 };
