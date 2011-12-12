/************************************/
var graph_data = [];
/************************************/
var series_template = '';
$.get('{{=URL(request.application, 'static/templates','series_options.html')}}', function(data) { series_template = data; });
/************************************/
function init_files(){
	$('.flise_file .select').click(function(){
		$('.current_record').html($(this).html());
		$('.current_record').attr('id', $(this).parent().attr('id'));
		$('#my_records').slideUp();
		var cur_id = $(this).parent().attr('id');
		$.getJSON('{{=URL('get_data.json')}}/'+cur_id,function(data){
			graph_data = data.result
			g.updateOptions( { 'file': graph_data, 'labels': data.labels } );
			$.getJSON('{{=URL('series_options.json')}}/'+cur_id,function(data){
				$('#series_options').html('');
				var colors = data.color;
				if (data.color == null) colors = g.colors_;
				for (var i = 0;i<data.num_series;i++){
					var st = series_template;
					st = st.replace(/%name%/, data.name[i]);
					if(data.show[i] == true) st = st.replace(/%show%/, 'checked');
					else st = st.replace(/%show%/, '');
					if(data.smooth[i] == true) st = st.replace(/%smooth%/, 'checked');
					else st = st.replace(/%smooth%/, '');
					st = st.replace(/%smooth_value%/, data.smooth_value[i]);
					st = st.replace(/%color%/, colors[i]);
					$('#series_options').append('<table>'+st+'</table>');
				}
				init_rangeslider();
				$('input[name="color"]').colorPicker();
				$('input[name="color"]').change(function(){
					var items = [];
					$('input[name="color"]').each(function(){
						items.push($(this).val());
					});
					g.updateOptions({'colors':items, 'file': graph_data});
				});
				$('input[name="series_name"]').change(function(){
					var items = ['Time'];
					$('input[name="series_name"]').each(function(){
						items.push($(this).val());
					});
					g.updateOptions({'labels':items, 'file': graph_data});
				});
				$('input[name="show"]').click(function(){
					var vis = []
					$('input[name="show"]').each(function (){
						if ($(this).is(':checked')) vis.push(true);
						else vis.push(false);
					});
					g.updateOptions({visibility: vis});
				});
				$('input[name="smooth"]').click(function(){
					$('input[name="smooth"]').each(function (){
						if ($(this).is(':checked')) g.updateOptions({rollPeriod: 2})
						else g.updateOptions({rollPeriod: 1});
					});
				});
			});
		});
		web2py_component('{{=URL('file')}}/'+$(this).parent().attr('id'),'edit_record')
	});
	$('.del').click(function(){
		$(this).parent().remove();
		$.ajax({
			url:'{{=URL('file')}}',
			data: {delr: $(this).parent().attr('id')}
		});
	});
	$('.del').confirm({
		stopAfter:'ok',
		wrapper: '<div class="del"></div>',
		timeout:3000,
		//timeout:9000,
	}); 
}
/************************************/
function init_rangeslider(){
    $('input[type="range"]').each(function(){
        $(this).parent().find('span').html($(this).val());
    });
    $('input[type="range"]').change(function(){
        $(this).parent().find('span').html($(this).val());
    });
}
/************************************/
jQuery(document).ready(function(){ 
    init_rangeslider();
});

/* ----------------------------SAM----------------------------------- */
var isSelecting = false;
var captCanvas = null;
var tool = 'zoom';//Default tool
//TO FALKO: Load positions from stored previously entered values (if any), or leave empty
var cutT = new Array();//Array or list
var nocutT = new Array();//Array of Array([start,end])
var dropT = new Array();//Array of Array([start,end])
var eventT = new Array();//Array or list

function getX(canvasx, g) {
	var points = g.layout_.points;
	if (points === undefined) return;
	var xval = -1;
	//Make a guess for position, and go back 10 before
	var istart = Math.max(0,Math.floor((points[0].canvasx-canvasx)*points.length/(g.rawData_[0].length-1)/(points[0].canvasx-points[points.length-1].canvasx)-10));
	// Loop through surroundings points and find the time nearest to our current location.
	var minDist = 1e+100;
	var idx = -1;
	for (var i = istart; i < points.length; i++) {
		var point = points[i];
		if (point == null) continue;
		var dist = Math.abs(point.canvasx - canvasx);
		if (dist > minDist) break;
		minDist = dist;
		idx = i;
	}
	if (idx >= 0) xval = points[idx].xval;
	return xval;
}

function drawSelectRect(event, g, context) {
	var ctx = g.canvas_ctx_;
	
	context.dragEndX = g.dragGetX_(event, context);
	context.dragEndY = g.dragGetY_(event, context);
	
	var xDelta = Math.abs(context.dragStartX - context.dragEndX);
	var yDelta = Math.abs(context.dragStartY - context.dragEndY);
	
	/*// drag direction threshold for y axis is twice as large as x axis
	context.dragDirection = (xDelta < yDelta / 2) ? Dygraph.VERTICAL : Dygraph.HORIZONTAL;*/
	// I constrain it to horizontal direction only (otherwise comment the following and uncomment what's above.)
	context.dragDirection = Dygraph.HORIZONTAL;
	
	
	// Clean up from the previous rect if necessary
	if (context.prevDragDirection == Dygraph.HORIZONTAL) {
		ctx.clearRect(Math.min(context.dragStartX, context.prevEndX), g.layout_.getPlotArea().y,
									Math.abs(context.dragStartX - context.prevEndX), g.layout_.getPlotArea().h);
	} else if (context.prevDragDirection == Dygraph.VERTICAL){
		ctx.clearRect(g.layout_.getPlotArea().x, Math.min(context.dragStartY, context.prevEndY),
										g.layout_.getPlotArea().w, Math.abs(context.dragStartY - context.prevEndY));
	}
	
		if (tool == 'nocut'){
		ctx.fillStyle = "rgba(128,255,128,0.33)";
	} else if (tool == 'cancel') {
		ctx.fillStyle = "rgba(255,128,128,0.33)";
	} else if (tool == 'drop') {
		ctx.fillStyle = "rgba(255,255,128,0.33)";
	} else {
		ctx.fillStyle = "rgba(128,128,128,0.33)";
	}
	// Draw a light-grey (default) rectangle to show the new viewing area
	if (context.dragDirection == Dygraph.HORIZONTAL) {
		if (context.dragEndX && context.dragStartX) {
		ctx.fillRect(Math.min(context.dragStartX, context.dragEndX), g.layout_.getPlotArea().y,
					 Math.abs(context.dragEndX - context.dragStartX), g.layout_.getPlotArea().h);
		}
	} else if (context.dragDirection == Dygraph.VERTICAL) {
		if (context.dragEndY && context.dragStartY) {
		ctx.fillRect(g.layout_.getPlotArea().x, Math.min(context.dragStartY, context.dragEndY),
					 g.layout_.getPlotArea().w, Math.abs(context.dragEndY - context.dragStartY));
		}
	}
	
	context.prevEndX = context.dragEndX;
	context.prevEndY = context.dragEndY;
	context.prevDragDirection = context.dragDirection;
	}

	function eraseSelectRect(g, context) {	
	// Clean up from the previous rect
	if (context.prevDragDirection == Dygraph.HORIZONTAL) {
	g.canvas_ctx_.clearRect(Math.min(context.dragStartX, context.prevEndX), g.layout_.getPlotArea().y,
					Math.abs(context.dragStartX - context.prevEndX), g.layout_.getPlotArea().h);
	} else if (context.prevDragDirection == Dygraph.VERTICAL){
	g.canvas_ctx_.clearRect(g.layout_.getPlotArea().x, Math.min(context.dragStartY, context.prevEndY),
					g.layout_.getPlotArea().w, Math.abs(context.dragStartY - context.prevEndY));
	}	
	// Update point display
	g.updateSelection_();  
	}

function drawInterval(g, startX, endX, color) {
	var ctx = captCanvas;
	var range = g.yAxisRange();
	var p1 = g.toDomCoords(startX, range[0]);
	var p2 = g.toDomCoords(endX, range[1]);
	// Draw a light-colored rectangle to show the new viewing area
	ctx.fillStyle = "rgba("+color[0]+","+color[1]+","+color[2]+",0.33)";
	ctx.fillRect(Math.min(p1[0], p2[0]), g.layout_.getPlotArea().y,Math.abs(p1[0]-p2[0]), g.layout_.getPlotArea().h/24);
	}

function drawVerticalLine(g, x, color) {
	var ctx = captCanvas;
	var range = g.yAxisRange();
	var p1 = g.toDomCoords(x, range[1]);
	var p2 = g.toDomCoords(x, range[1]-Math.abs(range[1]-range[0])/24);
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1.0;
	ctx.beginPath();
	ctx.moveTo(p1[0], p1[1]);
	ctx.lineTo(p2[0], p2[1]);
	ctx.closePath();
	ctx.stroke();
	ctx.restore(); 
	}

function finishSelect() {
	isSelecting = false;
}

function unifyT() {
	//Drop tool defines intervals to ignore (data to trash), therefore it has priority (one cannot insert a cut point or a nocut interval in a drop zone)
	for (iD=0; iD<dropT.length; iD++) {
		for (iC=0; iC<cutT.length; iC++) {
			if (cutT[iC]>dropT[iD][1]){break}
			if ((cutT[iC]>=dropT[iD][0])&&(cutT[iC]<=dropT[iD][1])){
				cutT.splice(iC,1);
				iC--;
			}
		}
		for (iN=0; iN<nocutT.length; iN++) {
			if (nocutT[iN][0]>dropT[iD][1]){break}
			if ((nocutT[iN][0]>=dropT[iD][0])&&(nocutT[iN][1]<=dropT[iD][1])){
				nocutT.splice(iN,1);
				iN--;
			} else if ((nocutT[iN][0]<dropT[iD][0])&&(nocutT[iN][1]>dropT[iD][0])){
				if(nocutT[iN][1]>dropT[iD][1]){
					nocutT.splice(iN, 1, [nocutT[iN][0], dropT[iD][0]], [dropT[iD][1], nocutT[iN][1]]);
				} else {
					nocutT[iN][1]=dropT[iD][0];
				}
			} else if ((nocutT[iN][0]<dropT[iD][1])&&(nocutT[iN][1]>dropT[iD][1])){
				//here we should have (nocutT[iN][0]>dropT[iD][0]) only
				nocutT[iN][0]=dropT[iD][1];
			}
		}
	}
	//Cut has priority over nocut interval.
	for (iC=0; iC<cutT.length; iC++) {
		for (iN=0; iN<nocutT.length; iN++) {
			if ((nocutT[iN][0]<cutT[iC])&&(nocutT[iN][1]>cutT[iC])){
				nocutT.splice(iN, 0, [nocutT[iN][0], cutT[iC]]);
				nocutT[iN+1][0]=cutT[iC];
			}
		}
	}
	
	//DRAW
	//Refresh
	var ctx = captCanvas;
	var area = g.layout_.getPlotArea();
	ctx.clearRect(area.x, area.y, area.w, area.h/24);
	//Draw drop intervals
	for (iD=0; iD<dropT.length; iD++) {
		drawInterval (g, dropT[iD][0], dropT[iD][1], [255,255,128]);
	}
	//Draw nocut intervals
	for (iN=0; iN<nocutT.length; iN++) {
		drawInterval (g, nocutT[iN][0], nocutT[iN][1], [128,255,128]);
	}
	//Draw cut lines
	for (iC=0; iC<cutT.length; iC++) {
		drawVerticalLine(g, cutT[iC], "#7fbf7f")
	}
}

function add2nocut(startX, endX) {
	//Check order
	if (endX<startX){
		var x = startX;
		startX = endX;
		endX = x;
	} else if (startX==endX) {
		return
	}
	//If array is empty, initialize
	if (nocutT.length==0){
		nocutT.push([startX, endX])
	} else {
		//Test if [s,e] overlaps with any already existing nocutT interval, in which case it joins them.
		var insertT = false;
		for (i=0; i<nocutT.length; i++) {
			if ((endX>nocutT[i][0])&&(startX<nocutT[i][0])){
				insertT = true;
				nocutT[i][0]=startX
			}
			if ((endX>nocutT[i][1])&&(startX<nocutT[i][1])){
				insertT = true;
				nocutT[i][1]=endX
			}
			if ((endX<nocutT[i][1])&&(startX>nocutT[i][0])){
				return
			}
		}
		//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
		//otherwise, add the new segment at correct position so that it is sorted in increasing order.
		if (insertT){
			var countHowMany = 0;
			var index = 0;
			for (i=1; i<nocutT.length; i++) {
				if (nocutT[i-1][1]>=nocutT[i][0]){
					nocutT[i-1][1]=nocutT[i][1];
					countHowMany++;
					if (index==0){
						index=i;
					}
				} else if (index!=0) {
					i=i-countHowMany;
					nocutT.splice(index, countHowMany);
					index = 0;
					countHowMany = 0;
				}
				if ((index!=0)&&(i==nocutT.length-1)){
					nocutT.splice(index, countHowMany);
				}
			}
		} else {
			var flag = true;
			if (endX<nocutT[0][0]){
				nocutT.splice(0,0,[startX, endX])
				flag = false;
			} else {
				for (i=1; i<nocutT.length; i++) {
					if ((endX<nocutT[i][0])&&(startX>nocutT[i-1][1])){
						nocutT.splice(i,0,[startX, endX]);
						flag = false;
						break
					}
				}	
			}
			if (flag){
				nocutT.push([startX, endX])
			}
		}
	}
	unifyT();
}

function add2drop(startX, endX) {
	//Check order
	if (endX<startX){
		var x = startX;
		startX = endX;
		endX = x;
	} else if (startX==endX) {
		return
	}
	//If array is empty, initialize
	if (dropT.length==0){
		dropT.push([startX, endX])
	} else {
		//Test if [s,e] overlaps with any already existing dropT interval, in which case it joins them.
		var insertT = false;
		for (i=0; i<dropT.length; i++) {
			if ((endX>dropT[i][0])&&(startX<dropT[i][0])){
				insertT = true;
				dropT[i][0]=startX
			}
			if ((endX>dropT[i][1])&&(startX<dropT[i][1])){
				insertT = true;
				dropT[i][1]=endX
			}
			if ((endX<dropT[i][1])&&(startX>dropT[i][0])){
				return
			}
		}
		//if the interval overlaps with several existing intervals, then the previous joining makes them overlap, thus we have to clean
		//otherwise, add the new segment at correct position so that it is sorted in increasing order.
		if (insertT){
			var countHowMany = 0;
			var index = 0;
			for (i=1; i<dropT.length; i++) {
				if (dropT[i-1][1]>=dropT[i][0]){
					dropT[i-1][1]=dropT[i][1];
					countHowMany++;
					if (index==0){
						index=i
					}
				} else if (index!=0) {
					i=i-countHowMany;
					dropT.splice(index, countHowMany);
					index = 0;
					countHowMany = 0;
				}
				if ((index!=0)&&(i==dropT.length-1)) {
					dropT.splice(index, countHowMany)
				}
			}
		} else {
			var flag = true;
			if (endX<dropT[0][0]){
				dropT.splice(0,0,[startX, endX])
				flag = false;
			} else {
				for (i=1; i<dropT.length; i++) {
					if ((endX<dropT[i][0])&&(startX>dropT[i-1][1])){
						dropT.splice(i,0,[startX, endX]);
						flag = false;
						break
					}
				}	
			}
			if (flag){
				dropT.push([startX, endX])
			}
		}
	}
	unifyT();
}

function add2cut(X) {
	//If array is empty, initialize
	if (cutT.length==0){
		cutT.push(X);
	} else {
		//Check if it already exists
		for (i=0; i<cutT.length; i++) {
			if (cutT[i]==X){
				return
			}
		}
		//Otherwise insert it while preserving the increasing order
		var flag = true;
		if (X<cutT[0]){
			cutT.splice(0,0,X);
			flag = false;
		} else {
			for (i=1; i<cutT.length; i++) {
				if ((X>cutT[i-1])&&(X<cutT[i])){
					cutT.splice(i,0,X);
					flag = false;
					break
				}
			}
		}
		if (flag){
			cutT.push(X);
		}
	}
	unifyT();
}

function captureCanvas(canvas, area, g) {
	captCanvas = canvas;
}

	function change_tool(tool_div) {
		var ids = ['tool_zoom', 'tool_cut', 'tool_nocut', 'tool_drop', 'tool_event', 'tool_cancel'];
		for (var i = 0; i < ids.length; i++) {
			var div = document.getElementById(ids[i]);
			if (div == tool_div) {
				div.style.backgroundPosition = -(i * 32) + 'px -32px';
			} else {
				div.style.backgroundPosition = -(i * 32) + 'px 0px';
			}
		}
		tool = tool_div.id.replace('tool_', '');

		var dg_div = document.getElementById("graphdiv");
		if (tool == 'cut') {
			dg_div.style.cursor = 'url(icons/cursor-cut.png) 1 30, auto';
		} else if (tool == 'nocut') {
			dg_div.style.cursor = 'url(icons/cursor-nocut.png) 1 30, auto';
	} else if (tool == 'drop') {
			dg_div.style.cursor = 'url(icons/cursor-drop.png) 1 30, auto';
	} else if (tool == 'event') {
			dg_div.style.cursor = 'url(icons/cursor-event.png) 1 30, auto';
	} else if (tool == 'cancel') {
			dg_div.style.cursor = 'url(icons/cursor-cancel.png) 1 30, auto';
		} else if (tool == 'zoom') {
			dg_div.style.cursor = 'crosshair';
		}
	}
	
change_tool(document.getElementById("tool_"+tool));

g = new Dygraph(document.getElementById("graphdiv"), "",
{
	interactionModel: {
		mousedown: function (event, g, context) {
			if (tool == 'zoom') {
				Dygraph.defaultInteractionModel.mousedown(event, g, context);
			} else {
				// prevents mouse drags from selecting page text.
				if (event.preventDefault) {
					event.preventDefault();  // Firefox, Chrome, etc.
				} else {
					event.returnValue = false;  // IE
					event.cancelBubble = true;
				}
				context.px = Dygraph.findPosX(g.canvas_);
				context.py = Dygraph.findPosY(g.canvas_);
				context.dragStartX = g.dragGetX_(event, context);
				context.dragStartY = g.dragGetY_(event, context);
				if (tool == 'nocut' || tool == 'drop'  || tool == 'cancel') {
					isSelecting = true; 
				} else {
					//alert('Cut or event at t='+getX(context.dragStartX, g));
					if (tool =='cut'){
						add2cut(getX(context.dragStartX, g));
					}
				}
			}
		},
		mousemove: function (event, g, context) {
			if (tool == 'zoom') {
				Dygraph.defaultInteractionModel.mousemove(event, g, context);
			} else {
				if (!isSelecting) return;
				drawSelectRect(event, g, context);
			}
		},
		mouseup: function(event, g, context) {
			if (tool == 'zoom') {
				Dygraph.defaultInteractionModel.mouseup(event, g, context);
			} else if (tool == 'nocut' || tool == 'drop'  || tool == 'cancel') {			
				eraseSelectRect(g, context);
				if (tool == 'nocut'){
					if (context.prevEndX != null){
						add2nocut(getX(context.dragStartX,g),getX(context.dragEndX,g));
						//alert('Bloc selection from '+Math.min(getX(context.dragStartX,g),getX(context.dragEndX,g))+' to '+Math.max(getX(context.dragStartX,g),getX(context.dragEndX,g)));
					}
				} else if (tool == 'drop'){
					if (context.prevEndX != null){
						add2drop(getX(context.dragStartX,g),getX(context.dragEndX,g));
						//alert('Bloc selection from '+Math.min(getX(context.dragStartX,g),getX(context.dragEndX,g))+' to '+Math.max(getX(context.dragStartX,g),getX(context.dragEndX,g)));
					}
				}	
			}
			context.dragStartX = null;
			context.dragStartY = null;
			context.prevEndX = null;
			context.prevEndY = null;
			finishSelect();
		},
		mouseout: function(event, g, context) {
			if (tool == 'zoom') {
				Dygraph.defaultInteractionModel.mouseout(event, g, context);
			}
		},
		dblclick: function(event, g, context) {
			Dygraph.defaultInteractionModel.dblclick(event, g, context);
		},
		mousewheel: function(event, g, context) {
			var normal = event.detail ? event.detail * -1 : event.wheelDelta / 40;
			var percentage = normal / 50;
			var axis = g.xAxisRange();
			var xOffset = g.toDomCoords(axis[0], null)[0];
			var x = event.offsetX - xOffset;
			var w = g.toDomCoords(axis[1], null)[0] - xOffset;
			var xPct = w == 0 ? 0 : (x / w);
	
			var delta = axis[1] - axis[0];
			var increment = delta * percentage;
			var foo = [increment * xPct, increment * (1 - xPct)];
			var dateWindow = [ axis[0] + foo[0], axis[1] - foo[1] ];
	
			g.updateOptions({
				dateWindow: dateWindow
			});
			Dygraph.cancelEvent(event);
		}
	},
	strokeWidth: 1.5,
	gridLineColor: 'rgb(196, 196, 196)',
	logscale : false,
	underlayCallback : captureCanvas
});

window.onmouseup = finishSelect;
/* ------------------------------------------------------------------- */
