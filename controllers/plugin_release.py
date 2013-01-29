
class ContentTooShortError(Exception):
    def __init__(self,message):
        self.errorMessage = 'Bla: %s'% message

status_fkt = lambda message,close=False: sys.stderr.write(message)

def download_status_fkt(size_known,num_done,start=False,stop=False,url=''):
    ''' internal default function if no external UI functions were set (see L{setUIFunctions})'''
    import sys
    if size_known:
        percent = int(num_done*100/size_known)
    else:
        percent = int(num_done)
    if start:
        sys.stderr.write("Loading %s\n"%url)
    elif stop:
        sys.stderr.write("\nLoading Finished\n")
        return
    if not size_known: sys.stderr.write("%s B\r"%percent)
    else: sys.stderr.write( str(percent) + "% \r")
    sys.stdout.flush()

def _download(url,post_data=None):
    '''
    Function download is downloading and returning the database flatfiles.
    @param url     : url of a database flatfile
    @type url      : string            
    @param post_data : data for POST requests e.g. {'submit':'Download'}
    @type post_data : dict
    @return: downloaded page
    @rtype: str
    '''
    #-----------------------------------------------------
    #create a realistic user agent
    headers = {
    'User-Agent' : 'Mozilla/4.0 (compatible; MSIE 5.5; Windows NT)',
    'Accept' :
    'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5',
    'Accept-Language' : 'fr-fr,en-us;q=0.7,en;q=0.3',
    'Accept-Charset' : 'ISO-8859-1,utf-8;q=0.7,*;q=0.7'
    }
    #-----------------------------------------------------
    #check if we got an internet connetction
    #self.status_fkt('Checking connection ...')
    #if not self.checkConnection(): raise DatabaseError('No Internet Connection')
    #-----------------------------------------------------
    import sys
    status_fkt = lambda message,close=False: sys.stderr.write(message)
    status_fkt("Loading %s\n"%url)
    #-----------------------------------------------------
    reqObj = urllib2.Request(url, post_data, headers)
    fp = urllib2.urlopen(reqObj)
    headers = fp.info()
    ##    This function returns a file-like object with two additional methods:
    ##    * geturl() -- return the URL of the resource retrieved
    ##    * info() -- return the meta-information of the page, as a dictionary-like object
    ##Raises URLError on errors.
    ##Note that None may be returned if no handler handles the request (though the default installed global OpenerDirector uses UnknownHandler to ensure this never happens). 
    #-----------------------------------------------------
    #read & write fileObj to filename
    filename = 'outfile'
    outcontents=''
    result = filename, headers
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
        raise ContentTooShortError("retrieval incomplete: got only %i out of %i bytes %s" % (read, size))

    #-----------------------------------------------------
    # taking care of gzipped content
    if url.endswith(".gz"):
        import StringIO, gzip
        stream = StringIO.StringIO(outcontents)
        zfile = gzip.GzipFile(fileobj=stream)
        outcontents = zfile.read()
    #-----------------------------------------------------

    return outcontents

def download():
    response.files.append(URL(request.application, 'static/plugin_release', 'release.css'))
    return dict()

def version():
    '''
    show the current version of this application
    '''
    if not os.path.exists(os.path.join(request.folder, 'VERSION')):
        open(os.path.join(request.folder, 'VERSION'), 'w').write('0.0.1')
    return open(os.path.join(request.folder, 'VERSION'), 'r').read()

def check_version():
    '''
    show current version and check this is the current version
    '''
    if session.app_current_version and not request.vars.force:
        return session.app_current_version

    app_current_version = version()
    session.app_current_version = DIV('Version %s'%app_current_version)
    if os.path.exists(RELEASE_FOLDER):#dis da server, no moa chekkin here
        return 'X'
    #check for new version
    try:
        latest_version = _download(APPLICATION_URL + "/plugin_release/version")
        if latest_version > app_current_version:
            session.app_is_old_version = True
            session.app_current_version = str(DIV(DIV(_id='show_update'),' version %s is available '%latest_version, TAG['button']('update now', _onclick="web2py_component('%s', 'show_update')"%URL(request.application, 'plugin_release', 'update'), _class="button")))
    except urllib2.HTTPError, e:
        return 'http error %s, please retry'%e
    except urllib2.URLError, e:
        return 'url error %s'%e
    return session.app_current_version

def _extractall(filename, path='.', members=None):
    if not hasattr(tarfile.TarFile, 'extractall'):
        from tarfile import ExtractError

        class TarFile(tarfile.TarFile):

            def extractall(self, path='.', members=None):
                """Extract all members from the archive to the current working
             directory and set owner, modification time and permissions on
             directories afterwards. `path' specifies a different directory
             to extract to. `members' is optional and must be a subset of the
             list returned by getmembers().
                """

                directories = []
                if members is None:
                    members = self
                for tarinfo in members:
                    if tarinfo.isdir():

                        # Extract directory with a safe mode, so that
                        # all files below can be extracted as well.

                        try:
                            os.makedirs(os.path.join(path,
                                    tarinfo.name), 0777)
                        except EnvironmentError:
                            pass
                        directories.append(tarinfo)
                    else:
                        self.extract(tarinfo, path)

                # Reverse sort directories.

                directories.sort(lambda a, b: cmp(a.name, b.name))
                directories.reverse()

                # Set correct owner, mtime and filemode on directories.

                for tarinfo in directories:
                    path = os.path.join(path, tarinfo.name)
                    try:
                        self.chown(tarinfo, path)
                        self.utime(tarinfo, path)
                        self.chmod(tarinfo, path)
                    except ExtractError, e:
                        if self.errorlevel > 1:
                            raise
                        else:
                            self._dbg(1, 'tarfile: %s' % e)


        _cls = TarFile
    else:
        _cls = tarfile.TarFile

    tar = _cls(filename, 'r')
    ret = tar.extractall(path, members)
    tar.close()
    return ret

@auth.requires_membership('admin')
def status():
    response.files.append(URL(request.application, 'static/plugin_release', 'release.css'))
    return dict()

@auth.requires_membership('admin')
def update():
    '''
    update this app from a zip from the web
    '''
    if os.path.exists(RELEASE_FOLDER):
        return 'This is the server, should not update!'
    if not session.app_is_old_version:
        return 'Cannot find newer version.'
    filename = os.path.join(request.folder,'private','tmp.w2p')
    try:
        #open(filename, 'wb').write(_download(APPLICATION_URL + "/static/web2py.app.%s.w2p"%APPLICATION_NAME))
        open(filename, 'wb').write(_download(APPLICATION_PACKAGE_URL + "/web2py.app.%s.w2p"%APPLICATION_NAME))
    except ContentTooShortError, e:
        response.headers['web2py-component-flash'] = 'Update FAILED: %s <br/>Please retry or update manually'%e
        return ''


    tarname = os.path.join(request.folder, 'private', filename[:-4] + '.tar')
    fgzipped = gzopen(filename, 'rb')
    tarfile = open(tarname, 'wb')
    tarfile.write(fgzipped.read())
    tarfile.close()
    fgzipped.close()
    #path = os.path.join(request.folder, 'private', 'lala')
    path = request.folder
    _extractall(tarname, path)
    os.unlink(tarname)
    os.unlink(filename)
    #-------------------------------------------
    #copy site-packages 
    if False:
        w2p_sitep_path = os.path.join(request.env.web2py_path, 'site-packages')
        app_sitep_path = os.path.join(request.folder, 'site-packages')
        if os.path.exists(app_sitep_path):
            for p in os.listdir(app_sitep_path):
                w2p_p = os.path.join(w2p_sitep_path, p)
                app_p = os.path.join(app_sitep_path, p)
                if os.path.isdir(app_p): #dir 
                    if os.path.exists(w2p_p):
                        shutil.rmtree(w2p_p)
                    shutil.copytree(app_p, w2p_p)
                else: #file
                    if os.path.exists(w2p_p):
                        os.unlink(w2p_p)
                    shutil.copy(app_p, w2p_p)
    #-------------------------------------------
    session.app_current_version = None
    response.headers['web2py-component-flash'] = 'Updated %s. Some changes may require a restart of the server!'%APPLICATION_NAME
    return ''

def create(sub_release_folder, release_type, release_web2py_base, update_web2py = False):
    '''
    create a full release zip package
    '''
    #if there are no previous releases, set up everything needed
    import os
    if not os.path.exists(os.path.join(sub_release_folder, 'web2py')) or update_web2py:
        result = prepare_web2py(release_type)
        if not result == True:
            return result
    #now put this app as init app into the release subfolder 
    new_app_dir = os.path.join(release_web2py_base, 'applications', 'init')
    #check if there is an old version of the app still around, if yes delete it
    if os.path.exists(new_app_dir):
        shutil.rmtree(new_app_dir)
    os.mkdir(new_app_dir)
    #if os.path.exists(os.path.join(release_web2py_base, 'site-packages')):
    #    shutil.rmtree(os.path.join(release_web2py_base, 'site-packages'))
    #clean up web2py examples app
    print 'removing exmaple app' 
    if os.path.exists(os.path.join(release_web2py_base, 'applications', 'examples')):
        shutil.rmtree(os.path.join(release_web2py_base, 'applications', 'examples'))
    #copy files and folders of current app into release applications/init
    print 'copying app to web2py'
    for rdir in 'controllers cron languages models modules static views'.split():
        try:
            shutil.rmtree(os.path.join(new_app_dir, rdir))
        except:
            pass
        shutil.copytree(os.path.join(request.folder, rdir), os.path.join(new_app_dir, rdir), ignore=apply(shutil.ignore_patterns, IGNORE_PATTERNS))
    for rfile in 'VERSION __init__.py ABOUT LICENSE'.split():
        shutil.copy(os.path.join(request.folder, rfile), os.path.join(new_app_dir, rfile))
    #clean up
    for rdir in 'private errors uploads sessions errors databases'.split():
        try:
            os.mkdir(os.path.join(new_app_dir, rdir))
        except:
            pass
    print 'final preparations: startfile, executable flags, ...'
    if release_type == 'src':
        open(os.path.join(sub_release_folder, '%s'%APPLICATION_NAME), 'w').write('''#!/usr/bin/env bash
python web2py/applications/init/static/plugin_release/open_browser.py&
python web2py/web2py.py -p 8000 -a test -R ./application/init/open_browser.py''')
        import stat
        os.chmod(os.path.join(sub_release_folder, '%s'%APPLICATION_NAME), stat.S_IRWXU)
    elif release_type == 'win':
        shutil.copy(os.path.join(request.folder,'static', 'plugin_release', 'start.bat'), os.path.join(sub_release_folder, '%s.bat'%APPLICATION_NAME))
    elif release_type == 'osx':
        import stat
        os.chmod(os.path.join(sub_release_folder, 'web2py', 'web2py.app', 'Contents', 'MacOS',   'web2py'), 0755)
        os.chmod(os.path.join(sub_release_folder, 'web2py', 'web2py.app', 'Contents', 'MacOS',   'python'), 0755)
        os.rename(os.path.join(sub_release_folder, 'web2py', 'web2py.app'),os.path.join(sub_release_folder, 'web2py', '%s.app'%APPLICATION_NAME))
        targzit(os.path.join(sub_release_folder, 'web2py'), os.path.join(request.folder, 'static','%s_%s.tar.gz'%(APPLICATION_NAME, release_type)))
        os.rename(os.path.join(sub_release_folder, 'web2py', '%s.app'%APPLICATION_NAME), os.path.join(sub_release_folder, 'web2py', 'web2py.app'))
        return True
    print 'creating compressed release'
    targzit(sub_release_folder, os.path.join(request.folder, 'static','%s_%s.tar.gz'%(APPLICATION_NAME, release_type)))
    return True

def check_web2py_version(myversion, version_URL):
    """
    web2py check for new version
    """
    try:
        from urllib import urlopen
        version = urlopen(WEB2PY_VERSION_URL).read()
    except Exception:
        return -1, myversion

    if version > myversion:
        return True, version
    else:
        return False, version

def unzip(filename, dir, subfolder=''):
    """
    Unzips filename into dir (.zip only, no .gz etc)
    if subfolder!='' it unzip only files in subfolder
    """
    #filename = abspath(filename)
    if not zipfile.is_zipfile(filename):
        raise RuntimeError, 'Not a valid zipfile'
    zf = zipfile.ZipFile(filename)
    if not subfolder.endswith('/'):
        subfolder = subfolder + '/'
    n = len(subfolder)
    for name in sorted(zf.namelist()):
        if not name.startswith(subfolder):
            continue
        if name.endswith('/'):
            folder = os.path.join(dir,name[n:])
            if not os.path.exists(folder):
                os.mkdir(folder)
        else:
            outfile = open(os.path.join(dir, name[n:]), 'wb')
            outfile.write(zf.read(name))
            outfile.close()

def compress(path, archive, base_path, archive_type = 'zip'):
    paths = os.listdir(path)
    for p in paths:
        p = os.path.join(path, p) # Make the path relative
        if os.path.isdir(p): # Recursive case
            compress(p, archive, base_path, archive_type)
        else:
            if archive_type == 'zip':
                archive.write(p, './'+p[len(base_path):]) # Write the file to the zipfile
            elif archive_type == 'tar':
                archive.add(p, p[len(base_path):], False, glob_ignore)
    return

def targzit(path, archname):
    tarname = os.path.join(path, archname[:-7] + '.tar')
    archive = tarfile.TarFile(tarname, 'w')
    if os.path.isdir(path):
        compress(path, archive, path, 'tar')
    else:
        archive.add(p, p[len(base_path):])
    archive.close()

    tgzfp = gzopen(archname, 'wb')
    tfp = open(tarname, 'rb')
    tgzfp.write(tfp.read())
    tfp.close()
    tgzfp.close()
    #os.unlink(tarname)

def zipit(path, archname):
    # Create a ZipFile Object primed to write
    archive = zipfile.ZipFile(archname, "w", zipfile.ZIP_DEFLATED) # "a" to append, "r" to read
    # Recurse or not, depending on what path is
    if os.path.isdir(path):
        compress(path, archive, path)
    else:
        archive.write(path, './'+p[len(path):])
    archive.close()

def prepare_web2py(release_type):
    '''
    download the latest web2py version and extract it
    '''
    try:
        shutil.rmtree(os.path.join(RELEASE_FOLDER, release_type, 'web2py'))
    except OSError:
        pass
    #download
    download_url = 'http://www.web2py.com/examples/static/web2py_%s.zip'%release_type
    open(os.path.join(RELEASE_FOLDER, 'web2py_%s.zip'%release_type), 'w').write(_download(download_url))
    #unzip 
    #print os.path.join(RELEASE_FOLDER, 'web2py_%s.zip'%release_type)
    zf = zipfile.ZipFile(os.path.join(RELEASE_FOLDER, 'web2py_%s.zip'%release_type), 'r')
    zf.extractall(os.path.join(RELEASE_FOLDER, release_type))
    zf.close()
    if not os.path.exists(os.path.join( RELEASE_FOLDER, release_type, 'web2py')):
        return DIV('did not extract or something? X-(', _class='error')
    return True

@auth.requires_membership('admin')
def full_release():
    '''
    create a full release package for linux, windows and mac and put it in the configured location
    '''
    import os
    release_type = request.vars.type
    if not release_type in 'win src osx'.split():
        raise HTTP(500, 'unknown release type')

    #-------------------------------------------
    if not os.path.exists(RELEASE_FOLDER):
        os.mkdir(RELEASE_FOLDER)

    #-------------------------------------------
    sub_release_folder = os.path.join(RELEASE_FOLDER, release_type)

    release_web2py_base = os.path.join(sub_release_folder, 'web2py')
    if release_type == 'osx':
        release_web2py_base = os.path.join(sub_release_folder, 'web2py', 'web2py.app', 'Contents', 'Resources')
    #-------------------------------------------
    result = True
    if not (os.path.exists(sub_release_folder) and os.path.exists(os.path.join( release_web2py_base, 'VERSION')) ):
        result = create(sub_release_folder, release_type, release_web2py_base, True)
    else:
        current_web2py_version = open(os.path.join( release_web2py_base, 'VERSION')).read()
        new_web2py_version, web2py_version_number = check_web2py_version(current_web2py_version, WEB2PY_VERSION_URL)
        if new_web2py_version:
            result = create(sub_release_folder, release_type, release_web2py_base, True)
    #-------------------------------------------
    if not os.path.exists(os.path.join(request.folder, 'static','%s_%s.zip'%(APPLICATION_NAME, release_type))) or not os.path.exists(os.path.join(release_web2py_base, 'applications', 'init', 'VERSION')):
        result = create(sub_release_folder, release_type, release_web2py_base, False)
    else:
        release_version = open(os.path.join(release_web2py_base, 'applications', 'init', 'VERSION'),'r').read()
        current_version = open(os.path.join(request.folder, 'VERSION'), 'r').read()
        if release_version<current_version:
            result = create(sub_release_folder, release_type, release_web2py_base, False)
    #-------------------------------------------
    if not result == True:
        return result
    download_location = URL(request.application, 'static', '%s_%s.tar.gz' % (APPLICATION_NAME, release_type))
    return TAG['']('Success, file can be downloaded from: ',A(download_location, _href=download_location))
    #redirect(URL(request.application, 'static', '%s_%s.zip'%(APPLICATION_NAME, release_type)))

@auth.requires_membership('admin')
def edit_version():
    if not os.path.exists(os.path.join(request.folder, 'VERSION')):
        open(os.path.join(request.folder, 'VERSION'), 'w').write('0.0.1')
    form = form_factory(Field('version', default = version()), submit_button="Change")
    if form.accepts(request.vars, session, keepvalues = True):
        open(os.path.join(request.folder, 'VERSION'), 'w').write(form.vars.version)
    return form

@auth.requires_membership('admin')
def svn_update():
    import subprocess
    p = subprocess.Popen(['svn','up'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE, cwd = request.folder)
    ustdout,ustderr = p.communicate()
    return TAG[''](TABLE(
        TR(TH('command'), TH('stdout'), TH('stderr')),
        TR(TD('update'), TD(ustdout),TD(ustderr)),
        ))

@auth.requires_membership('admin')
def hg_update():
    import subprocess
    p = subprocess.Popen(['hg','pull'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE, cwd = request.folder)
    pstdout,pstderr = p.communicate()
    p = subprocess.Popen(['hg','update'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE, cwd = request.folder)
    ustdout,ustderr = p.communicate()
    return TAG[''](TABLE(
        TR(TH('command'), TH('stdout'), TH('stderr')),
        TR(TD('pull'), TD(pstdout),TD(pstderr)),
        TR(TD('update'), TD(ustdout),TD(ustderr)),
        ))

def glob_ignore(path):
    '''returns True it path matches a pattern from IGNORE_PATTERNS'''
    for pattern in IGNORE_PATTERNS:
        if fnmatch.fnmatch(path, pattern):
            return True
    else:
        return False

@auth.requires_membership('admin')
def core_release():
    '''
    create web2py .w2p package without the contents of e.g. the database folder
    '''
    #-------------------------------------------
    if not os.path.exists(RELEASE_FOLDER):
        os.mkdir(RELEASE_FOLDER)
    #-------------------------------------------
    tarname = os.path.join(RELEASE_FOLDER,APPLICATION_NAME + '.tar')
    tar = tarfile.TarFile(tarname, 'w')
    for rdir in 'controllers cron languages models modules static views'.split():
        compress(os.path.join(request.folder,rdir), tar, request.folder, 'tar')
        #tar.add(os.path.join(request.folder, rdir), rdir, exclude = glob_match)
    for rdir in 'databases cache'.split():
        tar.add(os.path.join(request.folder, rdir), rdir, False)
    for rfile in 'VERSION __init__.py ABOUT LICENSE'.split():
        tar.add(os.path.join(request.folder, rfile), rfile)
    tar.close()

    w2pfp = gzopen(os.path.join(request.folder, 'static', 'web2py.app.%s.w2p'%APPLICATION_NAME), 'wb')
    tarfp = open(tarname, 'rb')
    w2pfp.write(tarfp.read())
    w2pfp.close()
    tarfp.close()
    os.unlink(tarname)
    download_location = URL(request.application, 'static', 'web2py.app.%s.w2p'%APPLICATION_NAME)
    return TAG['']('Success, release can be downloaded from ', A(download_location, _href=download_location))

@auth.requires_membership('admin')
def all_release():
    '''
    create web2py .w2p package without the contents of e.g. the database folder
    create a full release package for linux, windows and mac and put it in the configured location
    '''
    #-------------------------------------------
    if not os.path.exists(RELEASE_FOLDER):
        os.mkdir(RELEASE_FOLDER)
    #--------------------W2P-----------------------
    tarname = os.path.join(RELEASE_FOLDER,APPLICATION_NAME + '.tar')
    tar = tarfile.TarFile(tarname, 'w')
    for rdir in 'controllers cron languages models modules static views'.split():
        compress(os.path.join(request.folder,rdir), tar, request.folder, 'tar')
        #tar.add(os.path.join(request.folder, rdir), rdir, exclude = glob_match)
    for rdir in 'databases cache'.split():
        tar.add(os.path.join(request.folder, rdir), rdir, False)
    for rfile in 'VERSION __init__.py ABOUT LICENSE'.split():
        tar.add(os.path.join(request.folder, rfile), rfile)
    tar.close()

    w2pfp = gzopen(os.path.join(request.folder, 'static', 'web2py.app.%s.w2p'%APPLICATION_NAME), 'wb')
    tarfp = open(tarname, 'rb')
    w2pfp.write(tarfp.read())
    w2pfp.close()
    tarfp.close()
    os.unlink(tarname)
    #--------------------SRC WIN OSX----------------------
    for release_type in 'win src osx'.split():
        sub_release_folder = os.path.join(RELEASE_FOLDER, release_type)
        release_web2py_base = os.path.join(sub_release_folder, 'web2py')
        if release_type == 'osx':
            release_web2py_base = os.path.join(sub_release_folder, 'web2py', 'web2py.app', 'Contents', 'Resources')
        result = True
        if not (os.path.exists(sub_release_folder) and os.path.exists(os.path.join( release_web2py_base, 'VERSION')) ):
            result = create(sub_release_folder, release_type, release_web2py_base, True)
        else:
            current_web2py_version = open(os.path.join( release_web2py_base, 'VERSION')).read()
            new_web2py_version, web2py_version_number = check_web2py_version(current_web2py_version, WEB2PY_VERSION_URL)
            if new_web2py_version:
                result = create(sub_release_folder, release_type, release_web2py_base, True)
        if not os.path.exists(os.path.join(request.folder, 'static','%s_%s.zip'%(APPLICATION_NAME, release_type))) or not os.path.exists(os.path.join(release_web2py_base, 'applications', 'init', 'VERSION')):
            result = create(sub_release_folder, release_type, release_web2py_base, False)
        else:
            release_version = open(os.path.join(release_web2py_base, 'applications', 'init', 'VERSION'),'r').read()
            current_version = open(os.path.join(request.folder, 'VERSION'), 'r').read()
            if release_version<current_version:
                result = create(sub_release_folder, release_type, release_web2py_base, False)
        if not result == True:
            return result
    return TAG['']('Success, release can be downloaded...')