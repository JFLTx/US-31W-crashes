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

// Global variable for the Section filter (default "all")
let activeSectionFilter = "all";

// Load crash data
d3.csv("data/final-crash-dataset.csv").then((data) => {
  let activeFilter = "all"; // 'all', 'Before', 'After'

  // Create arrays for before/after crashes based on construction status.
  const afterCrashes = data.filter(
    (d) => d["Before/After Construction"] === "After"
  );
  const beforeCrashes = data.filter(
    (d) => d["Before/After Construction"] === "Before"
  );

  const afterLayer = L.layerGroup();
  const beforeLayer = L.layerGroup();

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

  // Create markers and attach the full crash record (including Section)
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

      // Add tooltip content
      marker.feature = {
        tooltipContent: `
            <u>Collision Time</u>: ${crash.CollisionTime}<br>
            <u>Weather Condition</u>: ${crash.Weather}<br>
            <u>Roadway Condition</u>: ${crash.RdwyConditionCode}<br>
            <u>Lighting</u>: ${crash.LightCondition}<br>
            <u>Crash Description</u>: ${crash.DirAnalysisCode}`,
      };

      // Bind hover and tooltip
      hover(marker);
      marker.bindTooltip(marker.feature.tooltipContent);

      layer.addLayer(marker);
    });
  };

  const toggleInteraction = (activeLayer, inactiveLayer) => {
    // Enable hover and tooltips on the active layer
    activeLayer.eachLayer((layer) => {
      layer.setStyle({ interactive: true }); // Enable interaction
      layer.on("mouseover", function () {
        this.setStyle({ radius: 8, fillOpacity: 1 });
      });
      layer.on("mouseout", function () {
        this.setStyle({ radius: 6, fillOpacity: 0.8 });
      });
      if (!layer.getTooltip()) {
        layer.bindTooltip(
          layer.feature?.tooltipContent || "No additional info"
        );
      }
    });

    // Disable hover and tooltips on the inactive layer
    inactiveLayer.eachLayer((layer) => {
      layer.setStyle({ interactive: false }); // Disable interaction
      layer.off("mouseover mouseout"); // Disable hover
      if (layer.getTooltip()) {
        layer.unbindTooltip(); // Ensure tooltip is removed
      }
    });
  };

  // Recalculate crash stats (for the #stats div) based on current filters.
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

    statsContainer
      .append("h3")
      .style("text-align", "center")
      .text(`Crash Reduction: ${crashReduction.toFixed(1)}%`);

    statsContainer
      .append("h3")
      .style("text-align", "center")
      .text(`Injury Reduction: ${injuryReduction.toFixed(1)}%`);
  };

  // Update the map markers. Both activeFilter and activeSectionFilter are applied.
  const updateMap = () => {
    afterLayer.eachLayer((layer) => {
      const meetsBeforeAfter =
        activeFilter === "all" || activeFilter === "After";
      const meetsSection =
        activeSectionFilter === "all" ||
        layer.crashData.Section === activeSectionFilter;
      const opacity = meetsBeforeAfter && meetsSection ? 0.8 : 0.1;
      layer.setStyle({ fillOpacity: opacity });
    });

    beforeLayer.eachLayer((layer) => {
      const meetsBeforeAfter =
        activeFilter === "all" || activeFilter === "Before";
      const meetsSection =
        activeSectionFilter === "all" ||
        layer.crashData.Section === activeSectionFilter;
      const opacity = meetsBeforeAfter && meetsSection ? 0.8 : 0.1;
      layer.setStyle({ fillOpacity: opacity });
    });

    // Ensure both layers are added to the map
    if (!map.hasLayer(afterLayer)) map.addLayer(afterLayer);
    if (!map.hasLayer(beforeLayer)) map.addLayer(beforeLayer);

    // Create a feature group from markers that match both filters for zooming
    const matchingMarkers = [];
    afterLayer.eachLayer((layer) => {
      const meetsBeforeAfter =
        activeFilter === "all" || activeFilter === "After";
      const meetsSection =
        activeSectionFilter === "all" ||
        layer.crashData.Section === activeSectionFilter;
      if (meetsBeforeAfter && meetsSection) matchingMarkers.push(layer);
    });
    beforeLayer.eachLayer((layer) => {
      const meetsBeforeAfter =
        activeFilter === "all" || activeFilter === "Before";
      const meetsSection =
        activeSectionFilter === "all" ||
        layer.crashData.Section === activeSectionFilter;
      if (meetsBeforeAfter && meetsSection) matchingMarkers.push(layer);
    });
    if (matchingMarkers.length > 0) {
      const group = L.featureGroup(matchingMarkers);
      const bounds = group.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [25, 25] });
      }
    }
  };

  // Update the bar chart. This uses the section filter to recalc numbers.
  const updateCharts = () => {
    // Filter original data by section.
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

    const width = document.querySelector("#side-panel").clientWidth * 0.9; // 90% of side-panel width
    const labelHeight = 60; // Height for rotated labels
    const baseHeight = 350; // Base chart height
    const dynamicHeight = baseHeight + labelHeight; // Total height with labels

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

    // Draw bars with animation
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

    // Add labels above bars
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

    // Add x-axis
    svg
      .append("g")
      .attr("transform", `translate(0, ${dynamicHeight - margin.bottom})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    // Add y-axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(yScale));
  };

  // Add markers to their respective layers
  addCrashesToLayer(beforeCrashes, beforeLayer, "#F40000");
  addCrashesToLayer(afterCrashes, afterLayer, "#2D72FF");

  // Initial rendering of map, charts, and stats
  updateMap();
  updateCharts();
  calcStats();

  // Event listener for the before/after dropdown changes
  d3.select("#selectionControl").on("change", function () {
    activeFilter = this.value;

    if (activeFilter === "Before") {
      toggleInteraction(beforeLayer, afterLayer);
    } else if (activeFilter === "After") {
      toggleInteraction(afterLayer, beforeLayer);
    } else {
      // Enable hover for all layers if "all" is selected
      beforeLayer.eachLayer((layer) => {
        layer.setStyle({ interactive: true });
        layer.on("mouseover", function () {
          this.setStyle({ radius: 8, fillOpacity: 1 });
        });
        layer.on("mouseout", function () {
          this.setStyle({ radius: 6, fillOpacity: 0.75 });
        });
        if (!layer.getTooltip()) {
          layer.bindTooltip(
            layer.feature?.tooltipContent || "No additional info"
          );
        }
      });
      afterLayer.eachLayer((layer) => {
        layer.setStyle({ interactive: true });
        layer.on("mouseover", function () {
          this.setStyle({ radius: 8, fillOpacity: 1 });
        });
        layer.on("mouseout", function () {
          this.setStyle({ radius: 6, fillOpacity: 0.75 });
        });
        if (!layer.getTooltip()) {
          layer.bindTooltip(
            layer.feature?.tooltipContent || "No additional info"
          );
        }
      });
    }
    updateMap();
    updateCharts();
    calcStats();
  });

  // Event listener for the section dropdown changes
  d3.select("#sectionControl").on("change", function () {
    activeSectionFilter = this.value;
    updateMap();
    updateCharts();
    calcStats();
  });
});

// Additional helper function for adding divs dynamically
d3.select("#ui-controls").append("div").attr("id", "chart-container");
