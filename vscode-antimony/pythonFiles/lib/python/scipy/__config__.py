# This file is generated by numpy's setup.py
# It contains system_info results at the time of building this package.
__all__ = ["get_info","show"]


import os
import sys

extra_dll_dir = os.path.join(os.path.dirname(__file__), '.libs')

if sys.platform == 'win32' and os.path.isdir(extra_dll_dir):
    if sys.version_info >= (3, 8):
        os.add_dll_directory(extra_dll_dir)
    else:
        os.environ.setdefault('PATH', '')
        os.environ['PATH'] += os.pathsep + extra_dll_dir

lapack_mkl_info={}
openblas_lapack_info={'library_dirs': ['C:\\projects\\scipy-wheels\\scipy\\build\\openblas_lapack_info'], 'libraries': ['openblas_lapack_info'], 'language': 'f77', 'define_macros': [('HAVE_CBLAS', None)]}
lapack_opt_info={'library_dirs': ['C:\\projects\\scipy-wheels\\scipy\\build\\openblas_lapack_info'], 'libraries': ['openblas_lapack_info'], 'language': 'f77', 'define_macros': [('HAVE_CBLAS', None)]}
blas_mkl_info={}
blis_info={}
openblas_info={'library_dirs': ['C:\\projects\\scipy-wheels\\scipy\\build\\openblas_info'], 'libraries': ['openblas_info'], 'language': 'f77', 'define_macros': [('HAVE_CBLAS', None)]}
blas_opt_info={'library_dirs': ['C:\\projects\\scipy-wheels\\scipy\\build\\openblas_info'], 'libraries': ['openblas_info'], 'language': 'f77', 'define_macros': [('HAVE_CBLAS', None)]}

def get_info(name):
    g = globals()
    return g.get(name, g.get(name + "_info", {}))

def show():
    """
    Show libraries in the system on which NumPy was built.

    Print information about various resources (libraries, library
    directories, include directories, etc.) in the system on which
    NumPy was built.

    See Also
    --------
    get_include : Returns the directory containing NumPy C
                  header files.

    Notes
    -----
    Classes specifying the information to be printed are defined
    in the `numpy.distutils.system_info` module.

    Information may include:

    * ``language``: language used to write the libraries (mostly
      C or f77)
    * ``libraries``: names of libraries found in the system
    * ``library_dirs``: directories containing the libraries
    * ``include_dirs``: directories containing library header files
    * ``src_dirs``: directories containing library source files
    * ``define_macros``: preprocessor macros used by
      ``distutils.setup``

    Examples
    --------
    >>> np.show_config()
    blas_opt_info:
        language = c
        define_macros = [('HAVE_CBLAS', None)]
        libraries = ['openblas', 'openblas']
        library_dirs = ['/usr/local/lib']
    """
    for name,info_dict in globals().items():
        if name[0] == "_" or type(info_dict) is not type({}): continue
        print(name + ":")
        if not info_dict:
            print("  NOT AVAILABLE")
        for k,v in info_dict.items():
            v = str(v)
            if k == "sources" and len(v) > 200:
                v = v[:60] + " ...\n... " + v[-60:]
            print("    %s = %s" % (k,v))
