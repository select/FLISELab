from gluon.sqlhtml import form_factory
def index():
    return dict()

def setup_pymantis():
    '''
    get the mail config from the config file and create a from to edit it
    '''
    #if not auth.has_membership(role = 'admin'):
    #    return 'You need to login as admin to configure the SMTP server.'
    form = form_factory(
            Field('url', default = app_config.get('pymantis','url')),
            Field('login', default = app_config.get('pymantis', 'login'), widget=None if request.vars.show_pass else SQLFORM.widgets.password.widget, label="Login (user:password)") 
            )
    if form.accepts(request.vars, keepvalues = True):
        app_config.set('pymantis','url', form.vars.url)
        app_config.set('pymantis', 'login', form.vars.login)
        response.flash = 'pyMantis config saved'
    return form


def download_status_fkt(size_known,num_done,start=False,stop=False,url=''):
    ''' internal default function if no external UI functions were set (see L{setUIFunctions})'''
    import sys
    if size_known:
        percent = int(num_done*100/size_known)
    else:
        percent = int(num_done)
    if start: sys.stderr.write("Loading %s\n"%url)
    elif stop:
        sys.stderr.write("\nLoading Finished\n")
        return
    if not size_known: sys.stderr.write("%s B\r"%percent)
    else: sys.stderr.write( str(percent) + "% \r")
    sys.stdout.flush()

def sync_pymantis_strains():
    import urllib2
    import base64
    url = app_config.get('pymantis', 'url')
    username, password = app_config.get('pymantis', 'login').split(':')

    request = urllib2.Request(url)
    #base64string = base64.encodestring('%s:%s' % (username, password)).replace('\n', '')
    base64string = base64.encodestring(app_config.get('pymantis', 'login'))
    request.add_header("Authorization", "Basic %s" % base64string)
    fp = urllib2.urlopen(request)

    headers = fp.info()
    ##    This function returns a file-like object with two additional methods:
    ##    * geturl() -- return the URL of the resource retrieved
    ##    * info() -- return the meta-information of the page, as a dictionary-like object
    ##Raises URLError on errors.
    ##Note that None may be returned if no handler handles the request (though the default installed global OpenerDirector uses UnknownHandler to ensure this never happens). 
    #-----------------------------------------------------
    #read & write fileObj to filename
    outcontents=''
    bs = 1024*8
    size = -1
    read = 0
    blocknum = 0
    #-----------------------------------------------------
    size_known = "content-length" in headers
    if size_known:
        size_known = int(headers["Content-Length"])
        size = int(headers["Content-Length"])
    download_status_fkt(size_known,0,True,url=url)
    #-----------------------------------------------------
    while 1:
        block = fp.read(bs)
        if block == "":
            break
        read += len(block)
        outcontents+=block
        blocknum += 1
        #-------------------------------------------
        download_status_fkt(size_known,(blocknum*bs),False,False)
    #-----------------------------------------------------
    download_status_fkt(size_known,size_known,False,True)
    fp.close()
    del fp
    #-----------------------------------------------------
    # raise exception if actual size does not match content-length header
    if size >= 0 and read < size:
        raise HTTP(500, "retrieval incomplete: got only %i out of %i bytes %s" % (read, size))

    #-----------------------------------------------------
    # taking care of gzipped content
    if url.endswith(".gz"):
        import StringIO, gzip
        stream = StringIO.StringIO(outcontents)
        zfile = gzip.GzipFile(fileobj=stream)
        outcontents = zfile.read()
    #-----------------------------------------------------
    return outcontents

def first_user():
    '''
    check if there is a user in the db
    if yes edit the user if admin
    if not create the user and create a admin group and add the user to the admin group
    '''
    #check if there are users
    first_user = db(db.auth_user.id == 1).select().first()
    #------------------------------------
    #created all the groups that are needed
    if not auth.id_group('admin'):
        auth.add_group('admin', 'Administrator,manager of this app. You can add more than one memeber to this group')
    #------------------------------------
    #if first user is not admin, make him admin
    if first_user and not auth.has_membership(user_id = first_user, role = 'admin'):
        auth.add_membership('admin', first_user)
    #------------------------------------
    #if there is a first user but the current user is not logged in as admin
    if first_user and not auth.has_membership('admin'):
        return 'first user exists, you need to login as admin to configure the first user'
    #------------------------------------
    #if there is no first user, return a form to create him
    if not first_user:
        def on_accept(form):
            auth.add_membership('admin', form.vars.id)
            auth.login_bare(form.vars.email, request.vars.password)
            redirect(URL(request.application, 'default', 'index'))
        form = crud.create(db.auth_user, onaccept = on_accept)
    else:
        #if the current user is admin
        if auth.has_membership(role = 'admin'):
            def on_accept():
                response.flash = 'saved user'
            form = crud.update(db.auth_user, first_user, onaccept = on_accept)
        else:
            #get admin users
            admin_users = ['%(first_name)s %(last_name)s'%u for u in db(db.auth_user.id>0).select() if auth.has_membership(role = 'admin', user_id = u)]
            return TAG['']('A admin user exists, please login as admin to complete the setup', BR(), 'Admin users are: ',UL([LI(aun) for aun in admin_users]))
    return dict(form = form)

