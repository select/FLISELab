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
        response.headers['web2py-component-command'] = 'web2py_ajax_page("GET","%s","","my_records");' % URL(r=request, f='files')
    if request.args(0):
        db.flise_file.file.readable, db.flise_file.file.writable = False, False
        form = crud.update(db.flise_file, request.args(0), onaccept=on_accept, deletable=False)
        submit = form.element("input",_type="submit")
        submit["_value"] = "update"
    else:
        form = crud.create(db.flise_file, onaccept=on_accept)
    return TAG[''](JS(response.headers['web2py-component-command']) if response.headers.has_key('web2py-component-command') else '', form)

def get_data():
    response.generic_patterns = ['html', 'json']
    record = db.flise_file[int(request.args(0))]
    filename, raw_file = db.flise_file.file.retrieve(record.file)
    import csv
    reader = list(csv.reader(raw_file, delimiter="\t"))
    csv_data = [[i*record.sampling_time]+line[:-1] for i,line in enumerate(reader)]
    labels = ['Time']+['col%s'%i for i,x in enumerate(csv_data[0][1:])]
    if request.extension == 'json':
        return dict(result=csv_data,labels = labels)
    #not really working so better not use it
    data = '\\n'.join([','.join([str(x) for x in line]) for line in csv_data])
    return data

def series_options():
    response.generic_patterns = ['json']
    record = db.flise_file[int(request.args(0))]
    colors = 'aaa bbb ccc ddd eee'.split()
    if request.vars.series_names:
        record.update_record(
                series_names = request.vars.getlist('series_names'),
                series_colors = request.vars.getlist('series_colors'),
                series_show = request.vars.getlist('series_show'),
                series_smooth = request.vars.getlist('series_smooth'),
                series_smooth_values = [float(x) for x in request.vars.getlist('series_smooth_values')]
                )
    def get_defaults():
        filename, raw_file = db.flise_file.file.retrieve(record.file)
        import csv
        reader = list(csv.reader(raw_file, delimiter="\t"))
        num_series = len(reader[0])-1
        name = ['col%s'%i for i in range(num_series)]
        color = None
        show = [True for i in range(num_series)]
        smoth = [False for i in range(num_series)]
        smoth_value = [1.5 for i in range(num_series)]
        return dict(name = name, color = color, show = show, smoth = smoth, smoth_value = smoth_value, num_series = num_series)
    if not record.series_names:#get default values
        return get_defaults()
    else:
        name = record.series_names
        num_series = len(name)
        color = record.series_colors
        show = record.series_show
        smoth = record.series_smooth
        smoth_value = record.series_smooth_values
    return dict(name = name, color = color, show = show, smoth = smoth, smoth_value = smoth_value, num_series = num_series)

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
