v169 ROOT CAUSE FIX
1. Broken <polyline pressure-line> was corrupting SVG → dots never reliable
2. Live dots now in dedicated <g id="pressure-live"> / <g id="tide-live"> ON TOP (never overwritten)
3. Live index = closest hour to clock time
4. Moon: final 68px block kills 120px conflicts
