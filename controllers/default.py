# -*- coding: utf-8 -*-
# this file is released under public domain and you can use without limitations

#########################################################################
## This is a samples controller
## - index is the default action of any application
## - user is required for authentication and authorization
## - download is for downloading files uploaded in the db (does streaming)
## - call exposes all registered services (none by default)
#########################################################################

def index():
    """
    example action using the internationalization operator T and flash
    rendered by views/default/index.html or views/generic.html
    """
    response.files.append(URL(request.application, 'static/dygraphs', 'dygraph-dev.js'))
    response.files.append(URL(request.application, 'static/html5slider', 'html5slider.js'))      #to REMOVE in the end
    response.files.append(URL(request.application, 'static/js', 'jquery.confirm.js'))
    response.files.append(URL(request.application, 'static/colorpicker', 'jquery.colorPicker.js'))
    response.files.append(URL(request.application, 'static/colorpicker', 'colorPicker.css'))
    response.files.append(URL(request.application, 'static/css', 'flise.css'))
    #import os
    #data = open(os.path.join(request.folder, 'private', 'FLISE', 'data.csv')).readlines()
    #data = '\\n'.join([l[:-1] for l in data])
    #return dict(data = data)
    return dict(data = '')

def files():
    records = db(db.flise_file.id>0).select()
    items = []
    for record in records:
        filename, file = db.flise_file.file.retrieve(record.file)
        items.append(LI(DIV(record.name if record.name else filename, _class="select"), DIV('delete', _class="del"), _class='flise_file', _id=record.id))
    return TAG[''](JS('init_files();'),UL(items, _id="flise_files"))

def file():
    if request.vars.delr:
        #FIXME add authentication here
        del db.flise_file[int(request.vars.delr)]
        return ''
    def on_accept(form):
        response.headers['web2py-component-command'] = 'web2py_ajax_page("GET","%s","","my_records");$(".current_record").html("%s");' % (URL(r=request, f='files'),form.vars.name)
    if request.args(0):
        db.flise_file.file.readable, db.flise_file.file.writable = False, False
        form = crud.update(db.flise_file, request.args(0), onaccept=on_accept, deletable=False)
        submit = form.element("input",_type="submit")
        submit["_value"] = "update"
    else:
        db.flise_file.created_on.writable = False
        form = crud.create(db.flise_file, onaccept=on_accept)
    return TAG[''](JS(response.headers['web2py-component-command']) if response.headers.has_key('web2py-component-command') else '', form)

def store_option():
    record_id = request.vars.record_id
    var_name = request.vars.var_name
    val = request.vars.val
    db.flise_file[int(record_id)].update_record(**{var_name: val})

def store_subint_option():
    response.generic_patterns = ['json']
    flise_record_id = request.vars.flise_record_id
    interval_time = request.vars.interval_time
    record = db(db.subintervals.extract_time == interval_time)(db.subintervals.flise_file_id == flise_record_id).select().first()
    if request.vars.var_name:
        var_name = request.vars.var_name
        val = request.vars.val
        if record:
            record.update_record(**{var_name: val})
        else:
            record = db.subintervals.insert(flise_file_id=flise_record_id, extract_time=interval_time)
            record.update_record(**{var_name: val})
    if record:
        return dict([(field,record[field]) for field in db.subintervals.fields])
    else:
        return dict()

def get_data():
    response.generic_patterns = ['html', 'json']
    record = db.flise_file[int(request.args(0))]
    filename, raw_file = db.flise_file.file.retrieve(record.file)
    import csv
    reader = list(csv.reader(raw_file, delimiter="\t"))
    csv_data = [[i*record.sampling_time]+[float(x) for x in line[:-1]] for i,line in enumerate(reader)]
    #labels = [x.name for x in record.series_species_id.select()] or ['Species%s'%i for i,x in enumerate(csv_data[0][1:])]
    labels = record.series_species if record.series_species else ['Species%s'%i for i,x in enumerate(csv_data[0][1:])]
    labels = ['Time']+labels
    if request.extension == 'json':
        return dict(result=csv_data,labels = labels)
    #not really working so better not use it
    data = '\\n'.join([','.join([str(x) for x in line]) for line in csv_data])
    return data

def series_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]
    def get_defaults():
        filename, raw_file = db.flise_file.file.retrieve(record.file)
        import csv
        reader = list(csv.reader(raw_file, delimiter="\t"))
        num_series = len(reader[0])-1
        name = ['Species%s'%i for i in range(num_series)]
        color = None
        show = ['true' for i in range(num_series)]
        return dict(name = name, color = color, show = show, num_series = num_series)
    defaults = get_defaults()
    #name = [x.name for x in record.series_species_id.select()] or defaults["name"]
    name = record.series_species or defaults["name"]
    num_series = len(name) or defaults["num_series"]
    color = record.series_colors or defaults["color"]
    show = record.series_show or defaults["show"]
    #convert to boolean
    show_bool = [s in ['true','True','1'] for s in show]
    return dict(name = name, color = color, show = show_bool, num_series = num_series)

def species():
    #if request.vars.new_species:
    #    db.species.insert(name = request.vars.new_species, measured = True)
    records = db(db.flise_file.id>0).select(db.flise_file.series_species)
    species = set()
    for record in records:
        if record.series_species:
            for species_item in record.series_species:
                species.add(species_item)
    return SELECT([OPTION('')]+[OPTION(x,_value=x) for x in species], _name="select_species", _style="width:100px")

def global_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]
    def get_defaults():
        strain = 1 #'BN-1???'
        comments = 'General description, or any particular problem with the series...'
        smooth = False
        smooth_value = 10
        OD = 0
        dilution = 50
        cell_diameter = 4.5
        return dict(strain = strain, comments = comments, smooth = smooth, smooth_value = smooth_value, OD = OD, dilution = dilution, celld = cell_diameter)
    defaults = get_defaults()
    strain = record.strain_id or defaults["strain"]
    comments = record.comments or defaults["comments"]
    smooth = record.disp_smooth or defaults["smooth"]
    smooth_value = record.disp_smooth_value or defaults["smooth_value"]
    OD = record.optical_density or defaults["OD"]
    dilution = record.dilution_factor or defaults["dilution"]
    cell_diameter = record.cell_diameter or defaults["celld"]
    return dict(strain = strain, comments = comments, smooth = smooth, smooth_value = smooth_value, od = OD, dilution = dilution, celld = cell_diameter)

def get_savgol():
    response.generic_patterns = ['json']
    import savgol
    myinstance = savgol.Savgol(int(request.vars.w), int(request.vars.w), int(request.vars.order), request.vars.deriv)
    #from gluon.contrib import simplejson
    result = myinstance.filterTS(simplejson.loads(request.vars.data))
    return dict(result = result)

def export_spreadsheet():
    export_format = request.vars.format
    from gluon.contrib import simplejson
    try:
        header = simplejson.loads(request.vars.header)
        data = simplejson.loads(request.vars.data)
    except:
        import sys
        raise HTTP(500, 'Deserializing JSON input failed: %s'%sys.exc_info()[1])
    import tablib
    data = tablib.core.Dataset(headers=header)
    data.extend(data)
    if export_format in 'yaml csv xls xlsx':
        import gluon.contenttype
        import os.path
        response.headers['Content-Type'] = gluon.contenttype.contenttype('.%s'%export_format)
        response.headers['Content-disposition'] = 'attachment; filename=%s.%s' % (request.vars.filename, export_format)
        #response.write(getattr(data,export_format), escape=False)
        return getattr(data,export_format)
    return ''

def user():
    """
    exposes:
    http://..../[app]/default/user/login
    http://..../[app]/default/user/logout
    http://..../[app]/default/user/register
    http://..../[app]/default/user/profile
    http://..../[app]/default/user/retrieve_password
    http://..../[app]/default/user/change_password
    use @auth.requires_login()
        @auth.requires_membership('group name')
        @auth.requires_permission('read','table name',record_id)
    to decorate functions that need access control
    """
    return dict(form=auth())


def download():
    """
    allows downloading of uploaded files
    http://..../[app]/default/download/[filename]
    """
    return response.download(request,db)


def call():
    """
    exposes services. for example:
    http://..../[app]/default/call/jsonrpc
    decorate with @services.jsonrpc the functions to expose
    supports xml, json, xmlrpc, jsonrpc, amfrpc, rss, csv
    """
    return service()


@auth.requires_signature()
def data():
    """
    http://..../[app]/default/data/tables
    http://..../[app]/default/data/create/[table]
    http://..../[app]/default/data/read/[table]/[id]
    http://..../[app]/default/data/update/[table]/[id]
    http://..../[app]/default/data/delete/[table]/[id]
    http://..../[app]/default/data/select/[table]
    http://..../[app]/default/data/search/[table]
    but URLs bust be signed, i.e. linked with
      A('table',_href=URL('data/tables',user_signature=True))
    or with the signed load operator
      LOAD('default','data.load',args='tables',ajax=True,user_signature=True)
    """
    return dict(form=crud())
