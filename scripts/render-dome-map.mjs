import { readFileSync, writeFileSync } from 'node:fs';

const {elements} = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const nodes = new Map(elements.filter(item => item.type === 'node').map(node => [node.id, node]));
const ways = elements.filter(item => item.type === 'way' && item.tags).map(way => ({
  ...way, geometry: way.geometry ?? way.nodes.map(id => nodes.get(id)).filter(Boolean),
})).filter(way => way.geometry.length > 1);
const dome = ways.find(way => way.id === 28445837);
if (!dome) throw Error('PayPay Dome footprint missing from map data');
const extent = (key) => {
  const values = dome.geometry.map(point => point[key]);
  return [Math.min(...values), Math.max(...values)];
};
const [west, east] = extent('lon');
const [south, north] = extent('lat');
const lon = (west + east) / 2, lat = (south + north) / 2;
const scale = 190 / (north - south);
const project = p => [500 + (p.lon - lon) * scale * Math.cos(lat * Math.PI / 180), 500 - (p.lat - lat) * scale];
const path = way => way.geometry.map((point, index) =>
  (index ? 'L' : 'M') + project(point).map(n => n.toFixed(1)).join(' ')).join('');
const coast = ways.filter(way => way.tags.natural === 'coastline');
const roads = ways.filter(way => way.tags.highway);
const buildings = ways.filter(way => way.tags.building && way.id !== dome.id);
const parks = ways.filter(way => way.tags.leisure === 'park');
const outline = ways => ways.map(way => `<path d="${path(way)}"/>`).join('\n');
const filled = ways => ways.map(way => `<path d="${path(way)}Z"/>`).join('\n');
const major = ({tags}) => /motorway|trunk|primary|secondary|tertiary/.test(tags.highway);

writeFileSync(new URL('../dist/dome-map.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
<defs><filter id="relief" x="-10%" y="-10%" width="120%" height="120%">
<feDropShadow dx="3" dy="5" stdDeviation="2" flood-color="#333" flood-opacity=".20"/>
</filter></defs>
<rect width="1000" height="1000" fill="#e8e8e6"/>
<g fill="#cfcfcd">${coast.map(way => `<path d="${path(way)}L-500 -500H1500Z"/>`).join('')}</g>
<g fill="#dededb">${filled(parks)}</g>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
  <g stroke="#c2c2bf" stroke-width="2.5">${outline(coast)}</g>
  <g stroke="#d1d1cd" stroke-width="4">${outline(roads)}</g>
  <g stroke="#fafaf9" stroke-width="2.5">${outline(roads)}</g>
  <g stroke="#c4c4c0" stroke-width="12">${outline(roads.filter(major))}</g>
  <g stroke="#fff" stroke-width="8">${outline(roads.filter(major))}</g>
</g>
<g fill="#fff" stroke="#cbcbc7" stroke-width=".7" filter="url(#relief)">${filled(buildings)}</g>
<g fill="#f9f9f8" stroke="#bdbdb8" stroke-width="2" filter="url(#relief)">${filled([dome])}</g>
</svg>\n`);
console.log({buildings: buildings.length, roads: roads.length, shorelineSegments: coast.length, domeWidth: Math.round((east - west) * scale * Math.cos(lat * Math.PI / 180))});
