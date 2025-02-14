const options = {
  zoomControl: false,
  zoomSnap: 0.1,
};
const map = L.map("map", options);

L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);

map.createPane("labels");
map.getPane("labels").style.zIndex = 349;
map.getPane("labels").style.pointerEvents = "none";
L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
  {
    pane: "labels",
    opacity: 0.4,
    minZoom: 7,
  }
).addTo(map);

map.addControl(
  L.control.zoom({
    position: "topright",
  })
);

// Global variables for filtering. Both start as "all".
let activeFilter = "all"; // For Before/After Construction
let activeSectionFilter = "all";

// Load crash data
d3.csv("data/final-crash-dataset.csv").then((data) => {
  // Create arrays for before/after crashes based on construction status.
  const afterCrashes = data.filter(
    (d) => d["Before/After Construction"] === "After"
  );
  const beforeCrashes = data.filter(
    (d) => d["Before/After Construction"] === "Before"
  );

  const afterLayer = L.layerGroup();
  const beforeLayer = L.layerGroup();

  // Helper: add hover events to a marker.
  const hover = (marker) => {
    marker.on("mouseover", function () {
      this.setStyle({
        radius: 8,
        fillOpacity: 1,
      });
    });
    marker.on("mouseout", function () {
      this.setStyle({
        radius: 6,
        fillOpacity: 0.8,
      });
    });
  };

  // Create markers and attach full crash record (including Section).
  const addCrashesToLayer = (crashes, layer, color) => {
    layer.clearLayers();
    crashes.forEach((crash) => {
      const marker = L.circleMarker([+crash.Latitude, +crash.Longitude], {
        fillColor: color,
        weight: 0,
        radius: 6,
        fillOpacity: 0.8,
      });

      // Save the full crash record (for later filtering by Section)
      marker.crashData = crash;

      // Create tooltip content.
      marker.feature = {
        tooltipContent: `
          <u>Collision Time</u>: ${crash.CollisionTime}<br>
          <u>Weather Condition</u>: ${crash.Weather}<br>
          <u>Roadway Condition</u>: ${crash.RdwyConditionCode}<br>
          <u>Lighting</u>: ${crash.LightCondition}<br>
          <u>Crash Description</u>: ${crash.DirAnalysisCode}`,
      };

      // Bind hover events and tooltip.
      hover(marker);
      marker.bindTooltip(marker.feature.tooltipContent);

      layer.addLayer(marker);
    });
  };

  // Recalculate crash stats for the #stats div based on current filters.
  const calcStats = () => {
    // Filter by Section first.
    const filteredBefore = beforeCrashes.filter(
      (d) => activeSectionFilter === "all" || d.Section === activeSectionFilter
    );
    const filteredAfter = afterCrashes.filter(
      (d) => activeSectionFilter === "all" || d.Section === activeSectionFilter
    );

    // Calculate counts and injuries.
    const crashesBefore = filteredBefore.length;
    const injuriesBefore = filteredBefore.filter(
      (d) => +d.NumberInjured > 0
    ).length;
    const crashesAfter = filteredAfter.length;
    const injuriesAfter = filteredAfter.filter(
      (d) => +d.NumberInjured > 0
    ).length;

    // Calculate percentage reductions (guarding against division by zero)
    const crashReduction =
      crashesBefore > 0
        ? ((crashesBefore - crashesAfter) / crashesBefore) * 100
        : 0;
    const injuryReduction =
      injuriesBefore > 0
        ? ((injuriesBefore - injuriesAfter) / injuriesBefore) * 100
        : 0;

    // Update the #stats div
    const statsContainer = d3.select("#stats");
    statsContainer.selectAll("*").remove(); // Clear previous content

    // Create two headings with a span that holds the animated number.
    statsContainer
      .append("h3")
      .style("text-align", "center")
      .html("Crash Reduction: <span class='crashReduction'>0.0</span>%");

    statsContainer
      .append("h3")
      .style("text-align", "center")
      .html("Injury Reduction: <span class='injuryReduction'>0.0</span>%");

    // Animate the Crash Reduction number from 0 to crashReduction
    d3.select(".crashReduction")
      .transition()
      .duration(300)
      .tween("text", function () {
        let i = d3.interpolateNumber(0, crashReduction);
        return function (t) {
          d3.select(this).text(i(t).toFixed(1));
        };
      });

    // Animate the Injury Reduction number from 0 to injuryReduction
    d3.select(".injuryReduction")
      .transition()
      .duration(300)
      .tween("text", function () {
        let i = d3.interpolateNumber(0, injuryReduction);
        return function (t) {
          d3.select(this).text(i(t).toFixed(1));
        };
      });
  };

  // Check if a marker should be shown based on the active filters.
  const markerMatchesFilters = (layer) => {
    return (
      (activeFilter === "all" ||
        layer.crashData["Before/After Construction"] === activeFilter) &&
      (activeSectionFilter === "all" ||
        layer.crashData.Section === activeSectionFilter)
    );
  };

  // Update the map markers.
  const updateMap = () => {
    // Process afterLayer markers.
    afterLayer.eachLayer((layer) => {
      if (markerMatchesFilters(layer)) {
        layer.setStyle({ fillOpacity: 0.8 });
        layer.options.interactive = true;
        layer.off("mouseover mouseout");
        hover(layer);
        if (!layer.getTooltip()) {
          layer.bindTooltip(
            layer.feature?.tooltipContent || "No additional info"
          );
        }
      } else {
        layer.setStyle({ fillOpacity: 0.0 });
        layer.options.interactive = false;
        layer.off("mouseover mouseout");
        if (layer.getTooltip()) {
          layer.unbindTooltip();
        }
      }
    });

    // Process beforeLayer markers.
    beforeLayer.eachLayer((layer) => {
      if (markerMatchesFilters(layer)) {
        layer.setStyle({ fillOpacity: 0.8 });
        layer.options.interactive = true;
        layer.off("mouseover mouseout");
        hover(layer);
        if (!layer.getTooltip()) {
          layer.bindTooltip(
            layer.feature?.tooltipContent || "No additional info"
          );
        }
      } else {
        layer.setStyle({ fillOpacity: 0.0 });
        layer.options.interactive = false;
        layer.off("mouseover mouseout");
        if (layer.getTooltip()) {
          layer.unbindTooltip();
        }
      }
    });

    // Make sure both layers are added.
    if (!map.hasLayer(afterLayer)) map.addLayer(afterLayer);
    if (!map.hasLayer(beforeLayer)) map.addLayer(beforeLayer);

    // Zoom to markers matching the filters.
    const matchingMarkers = [];
    afterLayer.eachLayer((layer) => {
      if (markerMatchesFilters(layer)) matchingMarkers.push(layer);
    });
    beforeLayer.eachLayer((layer) => {
      if (markerMatchesFilters(layer)) matchingMarkers.push(layer);
    });
    if (matchingMarkers.length > 0) {
      const group = L.featureGroup(matchingMarkers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [25, 25] });
      }
    }
  };

  // --- New: Event listener for period buttons ---
  d3.selectAll(".period-button").on("click", function () {
    const selectedFilter = d3.select(this).attr("data-filter");
    const selectedSection = d3.select(this).attr("data-section");

    activeFilter = selectedFilter;
    activeSectionFilter = selectedSection;

    // Optionally, update the visual active state.
    d3.selectAll(".period-button").classed("active", false);
    d3.select(this).classed("active", true);

    updateMap();
    updateCharts();
    calcStats();
  });
  // --------------------------------------------------

  d3.select("#reset-filters").on("click", function () {
    activeFilter = "all";
    activeSectionFilter = "all";

    // Remove active styling from period buttons.
    d3.selectAll(".period-button").classed("active", false);

    updateMap();
    updateCharts();
    calcStats();
  });
  // --------------------------------------------------

  // Update the bar chart.
  const updateCharts = () => {
    const filteredBefore = beforeCrashes.filter(
      (d) => activeSectionFilter === "all" || d.Section === activeSectionFilter
    );
    const filteredAfter = afterCrashes.filter(
      (d) => activeSectionFilter === "all" || d.Section === activeSectionFilter
    );

    const chartData = [
      {
        label: "Before: Total Crashes",
        value: filteredBefore.length,
        type: "Before",
        color: "#F40000",
      },
      {
        label: "Before: Injuries",
        value: filteredBefore.filter((d) => +d.NumberInjured > 0).length,
        type: "Before",
        color: "#F40000",
      },
      {
        label: "After: Total Crashes",
        value: filteredAfter.length,
        type: "After",
        color: "#2D72FF",
      },
      {
        label: "After: Injuries",
        value: filteredAfter.filter((d) => +d.NumberInjured > 0).length,
        type: "After",
        color: "#2D72FF",
      },
    ];

    const chartContainer = d3.select("#chart-container");
    chartContainer.selectAll("*").remove();

    const width = document.querySelector("#side-panel").clientWidth * 0.9;
    const labelHeight = 60;
    const baseHeight = 300;
    const dynamicHeight = baseHeight + labelHeight;
    const margin = { top: 50, right: 20, bottom: 60 + labelHeight, left: 50 };

    const svg = chartContainer
      .append("svg")
      .attr("width", width)
      .attr("height", dynamicHeight);

    const xScale = d3
      .scaleBand()
      .domain(chartData.map((d) => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.1);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(chartData, (d) => d.value)])
      .range([dynamicHeight - margin.bottom, margin.top]);

    svg
      .selectAll(".bar")
      .data(chartData)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => xScale(d.label))
      .attr("y", yScale(0))
      .attr("width", xScale.bandwidth())
      .attr("height", 0)
      .attr("fill", (d) => d.color)
      .style("opacity", (d) =>
        activeFilter === "all" || activeFilter === d.type ? 1 : 0.2
      )
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => yScale(d.value))
      .attr("height", (d) => dynamicHeight - margin.bottom - yScale(d.value));

    svg
      .selectAll(".bar-label")
      .data(chartData)
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", (d) => xScale(d.label) + xScale.bandwidth() / 2)
      .attr("y", yScale(0) - 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#444")
      .text((d) => d.value)
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr("y", (d) => yScale(d.value) - 5);

    svg
      .append("g")
      .attr("transform", `translate(0, ${dynamicHeight - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale));
  };

  // Add markers to their respective layers.
  addCrashesToLayer(beforeCrashes, beforeLayer, "#F40000");
  addCrashesToLayer(afterCrashes, afterLayer, "#2D72FF");

  // Initial rendering of map, charts, and stats.
  updateMap();
  calcStats();
  setTimeout(updateCharts, 250);
});
