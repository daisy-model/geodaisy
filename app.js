import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import mapboxgl from 'mapbox-gl';

mapboxgl.accessToken = 'pk.eyJ1Ijoic25pZWJlIiwiYSI6ImNsZmppMGJqNTAxMWYzem8xY243NXY1MncifQ.6CHKZXlSjbaTqtNHRLQ4qA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',//'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  center: [8.60, 56.351],
  zoom: 10.5,
  bearing: 0,
  pitch: 0
});

map.addControl(new mapboxgl.NavigationControl());
