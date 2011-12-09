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
        $.getJSON('{{=URL('get_data.json')}}/'+$(this).parent().attr('id'),function(data){
            graph_data = data.result
            g.updateOptions( { 'file': graph_data, 'labels': data.labels } );
        });
        $.getJSON('{{=URL('series_options.json')}}/'+$(this).parent().attr('id'),function(data){
            $('#series_options').html('');
            for (var i = 0;i<data.num_series;i++){
                var st = series_template;
                st = st.replace(/%name%/, data.name[i]);
                if(data.show[i]) st = st.replace(/%show%/, 'checked');
                else st = st.replace(/%show%/, '');
                if(data.smoth[i]) st = st.replace(/%smoth%/, 'checked');
                else st = st.replace(/%smoth%/, '');
                st = st.replace(/%smoth_value%/, data.smoth_value[i]);
                st = st.replace(/%color%/, data.color[i]);
                //alert(st);
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
                //alert items
                g.updateOptions({'labels':items, 'file': graph_data});
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
/* ------------------------------------------------------------------- */
    var isSelecting = false;
    var tool = 'zoom';

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
		context.dragEndX = g.dragGetX_(event, context);
		context.dragEndY = g.dragGetY_(event, context);
		
		var xDelta = Math.abs(context.dragStartX - context.dragEndX);
		var yDelta = Math.abs(context.dragStartY - context.dragEndY);
		
		/*// drag direction threshold for y axis is twice as large as x axis
		context.dragDirection = (xDelta < yDelta / 2) ? Dygraph.VERTICAL : Dygraph.HORIZONTAL;*/
		// I constrain it to horizontal direction only (otherwise comment the following and uncomment what's above.)
		context.dragDirection = Dygraph.HORIZONTAL;
		
		g.drawZoomRect_(
			context.dragDirection,
			context.dragStartX,
			context.dragEndX,
			context.dragStartY,
			context.dragEndY,
			context.prevDragDirection,
			context.prevEndX,
			context.prevEndY);
		
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
	
	function finishSelect() {
		isSelecting = false;
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
                  alert('Cut or event at t='+getX(context.dragStartX, g));
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
				alert('Bloc selection from '+Math.min(getX(context.dragStartX,g),getX(context.dragEndX,g))+' to '+Math.max(getX(context.dragStartX,g),getX(context.dragEndX,g)));
				context.dragStartX = null;
				context.dragStartY = null;
				finishSelect();
              }
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
          gridLineColor: 'rgb(196, 196, 196)'
        });
		
    window.onmouseup = finishSelect;
/* ------------------------------------------------------------------- */
