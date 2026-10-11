# Ad targeting circles on the Istanbul district map

Meta ad sets here target with `custom_locations` circles. Coordinates guessed from memory were wrong
(2026-10-11: circles for Mimarsinan/Celaliye were in the sea, and "north Beylikdüzü" was mostly Esenyurt),
so check every circle against the real district borders before saving it.

    curl -sSo scripts/ads/targeting-map/istanbul-districts.json \
      https://raw.githubusercontent.com/ozanyerli/istanbul-districts-geojson/main/istanbul-districts.json
    G=scripts/ads/targeting-map/istanbul-districts.json

    # share of each circle per district ("sea" = water); args: [label, lat, lon, radius_km]
    python3 -I scripts/ads/targeting-map/check.py $G '[["x",41.02,28.59,3]]'

    # greedy circles that cover a whole district with <3% Esenyurt and >=55% inside it
    python3 -I scripts/ads/targeting-map/cover.py $G "Büyükçekmece" 12

    # picture for the owner (circles are listed inside make.py)
    H=$(python3 -I scripts/ads/targeting-map/make.py $G /tmp/map.html | cut -d' ' -f2)
    sed -i "s#file://FONTS#file://$PWD/scripts/social/fonts#g" /tmp/map.html
    GLOBAL_NM=/opt/node22/lib/node_modules node scripts/ads/targeting-map/shot.cjs /tmp/map.html /tmp/map.png 1600 $H
