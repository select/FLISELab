import os
import os.path
import urllib2
import zipfile
import tarfile
import fnmatch
from gzip import open as gzopen
import shutil
from gluon.sqlhtml import form_factory

#jn = os.path.join

##########################################
# if you want this application to be the release server you must once call the core_release or full_release function
# http://127.0.0.1:8000/pyMantis/plugin_release/core_release
# to do this you must belong to the group "admin"
##########################################
#config !!!!!!!!!!!!!!!!!! FIXME MUST BE IN db.py since this is now a conditional model
APPLICATION_NAME = 'FliseLab'
RELEASE_FOLDER = os.path.join(request.folder, 'private', 'release')
#this is the URL where the main app resides from which updates can be pulled
APPLICATION_URL = "http://translucent-network.org/FLISELAB"
APPLICATION_PACKAGE_URL = "http://translucent-network.org/fliselab_static"
WEB2PY_URL = 'http://web2py.com'
WEB2PY_VERSION_URL = WEB2PY_URL+'/examples/default/version'
IGNORE_PATTERNS = ('*web2py.app.*', '*.sw?', '*~', '*.pyc', 'CVS', '^.git', '*.svn', '*%s_*.zip'%APPLICATION_NAME, '*%s_*.tar*'%APPLICATION_NAME)
##########################################

