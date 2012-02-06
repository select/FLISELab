#!/usr/bin/env python
# encoding: utf-8
"""
savgol.py

Inspired by Numerical Recipes §14.9
There is also the sciPy implementation: http://www.scipy.org/Cookbook/SavitzkyGolay
But I don't want to use sciPy nor numPy to embed it easily in web2py.
Additionnally, the function proposed in the cookbook recalculates the S-G coefficients each time,
while it can be done one time for all time-series to process.

The S-G filter is an object of the class "savgol", with a method "filter".
See class description for more info.
// by S Drulhe - TBP.HU.Berlin, 2.2.12, sdrulhe*gmail.com
"""

class Savgol:
    """Smooth (and optionally differentiate) data with a Savitzky-Golay filter.
        The Savitzky-Golay filter removes high frequency noise from data.
        It has the advantage of preserving the original shape and
        features of the signal better than other types of filtering
        approaches, such as moving averages techhniques.
    -- Parameters
        nleft : int (default=16)
        nright: int (default=16)
           numbers of data points used resp. to the left (causal) and to the right (anticipate)
           The length of the filtering window is therefore window_size=nleft+nright+1, an odd integer number.
        order : int (default=4, sufficient for first-order derivation)
           the order of the polynomial used to locally fit the data (LS approach).
           Must be less than window_size-1.
        deriv: int
           the order of the derivative to compute (default = 0 means only smoothing).
    -- Notes
        The Savitzky-Golay is a type of low-pass filter, particularly
        suited for smoothing noisy data. The main idea behind this
        approach is to make for each point a least-square fit with a
        polynomial of high order over a local window.
    -- Examples
        import SavitzkyGolay
        from math import sin as _sin
        from random import random as _rand
        y = [_rand()*0.05+_sin(2*3.14*j/(25+175*j/1000)) for j in range(1000)]
        mySG = Savgol(nleft=16, nright=16, order=4, deriv=0)
        ySG = mySG.filterTS(y)
    -- References
        [1] A. Savitzky, M. J. E. Golay, Smoothing and Differentiation of
        Data by Simplified Least Squares Procedures. Analytical
        Chemistry, 1964, 36 (8), pp 1627-1639.
        [2] Numerical Recipes 3rd Edition: The Art of Scientific Computing
        W.H. Press, S.A. Teukolsky, W.T. Vetterling, B.P. Flannery
        Cambridge University Press ISBN-13: 9780521880688
    """
    def __init__(self, nleft=16, nright=16, order=4, deriv=0):
        def matdim(A):
            """
            Returns the number of rows and columns of A.
            """
            if hasattr(A, "__len__"):
                m = len(A)
                if hasattr(A[0], "__len__"):
                    n = len(A[0])
                else:
                    n = 0
            else:
                m = 0  # not a matrix!
                n = 0
            return (m, n)

        def transpose(A):
            """
            Returns the transpose of A.
            """
            m,n = matdim(A)
            At = [[0] * m for j in range(n)]
            for i in range(m):
                for j in range(n):
                    At[j][i] = A[i][j]
            return At

        def matlufactor(A, ztol = 1.0e-12):
            """
            ipivot, LU, detsign = matlufac(A, ztol(optional))
            Parameters
                    A                 input: matrix to be factored
                    ztol              input: zero value tolerance
            Returns
                    ipivot            output:  array of row interchanges made.
                    LU                output:  LU decomposition of matrix A.
                    detsign           output:  sign of determinant.

            Description
                    Splits a square matrix A into a lower and an upper
                    triangular matrix L and U, stored in LU, with the row interchanges
                    stored in  ipivot using implicit scaled partial pivoting.
            """
            (nrows,  ncols) = matdim(A)
            LU = [A[i][:] for i in range(nrows)]
            ipivot = range(nrows)
            #Factoring matrix.
            # initialize rowperm, D, detsign
            D = [0.0] * nrows
            detsign = 1
            for i in range(nrows):
                ipivot[i] = i
                rowmax = max([abs(x) for x in LU[i]])
                if rowmax <= ztol:
                    detsign =  0
                    rowmax  = 1.0
                D[i] = rowmax
            if nrows <= 1:
                return None,  None,  None
            for k in range(nrows-1):
                colmax = abs(LU[k][k]) / D[k]
                istar = k
                for i in range(k+1, nrows):
                    t = abs(LU[i][k]) / D[i]
                    if t > colmax:
                        colmax  = t
                        istar = i
                if colmax <= ztol:
                    detsign = 0
                else:
                    if istar > k:
                        #Make row exchanges?
                        detsign = -detsign
                        ipivot[istar], ipivot[k] = ipivot[k], ipivot[istar]
                        D[istar], D[k] = D[k], D[istar]
                        for j in range(ncols):
                            LU[istar][j], LU[k][j] = LU[k][j],LU[istar][j]
                    # Elimination
                    for i in range(k+1, nrows):
                        ratio = LU[i][k] = LU[i][k] / LU[k][k]
                        for j in range(k+1,  ncols):
                            LU[i][j] = LU[i][j] - ratio * LU[k][j]
            return LU, ipivot, detsign

        def matlusolve(LU, ipivot, B):
            """
            Parameters:
                LU          LU decomposition matrix
                ipivot      row interchanges vector
                B           RHS vector of (LU) X = B
            Output:
                X           unknown solution vector to be solved
            Description
                Solves the equation  (LU) X = B for X.
                Once we have an LU factorization of a matrix A,
                it is very easy to solve for X given any RHS vector B.
            Reference
                This routine is based on a FORTRAN 77 routine
                SUBST of Conte and deBoor.
            """
            nrows,  ncols = matdim(LU)
            X = B[:]
            if (nrows == 1) :
                X[0] = B[0] / LU[0][0]
                return X
            #  Forward substitution
            X[0] = B[ipivot[0]]
            for i in range(1, nrows):
                t = 0.0
                for j in range(i):
                    t += (LU[i][j] * X[j])
                X[i] = B[ipivot[i]] - t
            # Back substitution
            X[nrows-1] = X[nrows-1] / LU[nrows-1][nrows-1]
            for i in range(nrows-2 , -1, -1):
                t = sum([LU[i][j] * X[j] for j in range(i+1,  ncols)])
                X[i] = (X[i] - t) / LU[i][i]
            return X

        def  matluinv(LU, ipivot):
            """
            Parameters
              LU               input:  LU decomposition of a matrix A
              ipivot           input:  row interchanges vector
            Returns
              InvLU             output: returned inverse of A
            Description
              Computes InvLU = inv(A) by using the LU decomposition of A.
              Computes the inverse of matrix LU. Because the LU decompositon
              is performed before calling this routine, matrix A or InvA should be
              non-singular.
            """
            nrows = len(LU)
            X = [0.0] * nrows
            Ainv = []
            #make repeated calls to matlusolve.
            for i in range(nrows):
                # Set up identity matrix column
                B = [0.0] * nrows
                B[i] = 1.0
                X = matlusolve(LU, ipivot, B)
                Ainv.append(X[:])
            return transpose(Ainv)

        #0. test the arguments
        try:
            nleft = abs(int(nleft))
            nright = abs(int(nright))
            order = abs(int(order))
        except ValueError, msg:
            raise ValueError("nleft, nright and order have to be of type int")
        if nleft < 0 or nright < 0 or nleft+nright < 1:
            raise TypeError("nleft and nright should be positive integers, their sum strictly positive")
        if nleft+nright < order:
            raise TypeError("window size is too small for the polynomials order")
        if deriv > order:
            raise TypeError("order of the desired derivation is too large for the polynomials order")
        
        self.nleft = nleft
        self.nright = nright
        #1. precompute coefficients
        #1.1 construct AtA=transpose(A).A with A_{ij}=i^j for i in {-nleft, ..., nright} and j in {0, ..., order}
        order_range = range(order+1)
        AtA = [[0.0 for i in order_range] for j in order_range]
        for ipj in range(2*order+1):
            sumV = (0.0 if ipj else 1.0)
            for k in range(1,nright+1):
                sumV += k**ipj
            for k in range(1,nleft+1):
                sumV += (-k)**ipj
            mm = min(ipj, 2*order-ipj)
            for imj in range(-mm,mm+1,2):
                AtA[(ipj+imj)/2][(ipj-imj)/2] = sumV
        #1.2 LU inv
        #Reference
        #       Conte and deBoor "Elementary Numerical Analysis", 3e, pp.Sec. 4.,  pp.160-168.
        #Inspired by a script from Ernesto P. Adorio
        #       http://adorio-research.org/wordpress/?p=193
        LU,  ipivot,  detsign = matlufactor(AtA)
        invLU = matluinv(LU,  ipivot)
        #2. compute the resulting filter
        #2.1 filter is vector c s.t. c_n = AtA^-1[deriv].transpose([n^0, .., n^order]) * deriv! with n in {-nleft, ..., nright}
        filter = [0.0 for i in range(nleft+nright+1)]
        from math import factorial as _fact
        coeff = _fact(deriv)
        for k in range(-nleft, nright+1):
            sumV = invLU[deriv][0]
            fac = 1.0
            for mm in range(1,order+1):
                fac *= k
                sumV += invLU[deriv][mm]*fac
            filter[k+nleft] = sumV * coeff
        #2.2 return
        self.filter = filter


    def filterTS(self, y):
        '''filterTS(y)
        Savitzky-Golay filtering of the input time-series "y"
        The paramters of the S-G filter were defined when the object was created.
        Parameters
        ----------
        y : time-series (array)
            the values of the time history of the signal.

        Returns
        -------
        ys : filtered time-series (array)
             the smoothed signal (or it's n-th derivative).
        '''

        def matdim(A):
            """
            Returns the number of rows and columns of A.
            """
            if hasattr(A, "__len__"):
                m = len(A)
                if hasattr(A[0], "__len__"):
                    n = len(A[0])
                else:
                    n = 0
            else:
                m = 0  # not a matrix!
                n = 0
            return (m, n)

        def matabs(A):
            """
            Returns the abs of A elementwise.
            """
            m,n = matdim(A)
            Aa = [[0] * m for j in range(n)] if n!=0 else [0]*m
            for i in range(m):
                if n==0:
                    Aa[i]=abs(A[i])
                else:
                    for j in range(n):
                        Aa[i][j] = abs(A[i][j])
            return Aa

        def mattranslate(A, k):
            """
            Returns A + k.
            """
            m,n = matdim(A)
            At = [[0] * m for j in range(n)] if n!=0 else [0]*m
            for i in range(m):
                if n==0:
                    At[i] = A[i] + k
                else:
                    for j in range(n):
                        At[i][j] = A[i][j] + k
            return At

        def fconv(f, y, nl, nr):
            """
            Modified convolution using discrete summation.
                f*y[i] = \sum_{n=-nl}^nr f(n) y(i+n)
            The convolution product is only given for points where the signals overlap completely.
            Values outside the signal boundary have no effect.
            """
            g = []
            for i in range(nl,len(y)-nr):
                sumV = 0
                for n in range(-nl,nr+1):
                    sumV += f[n+nl] * y[i+n]
                g.append(sumV)
            return g

        if len(self.filter) > len(y):
            raise TypeError("timeseries size must be bigger than size of filter")
        # pad the signal at the extremes with values taken from the signal itself
        firstvals = mattranslate(matabs(mattranslate(y[1:self.nright+1][::-1],-y[0])),y[0])
        lastvals =  mattranslate(matabs(mattranslate(y[-self.nleft-1:-1][::-1], - y[-1])),y[-1])
        y = firstvals + y + lastvals
        # convolve the padded signal with the filter list
        return fconv(self.filter, y, self.nleft, self.nright)


if __name__ == '__main__':
    from math import sin as _sin
    from random import random as _rand
    TS = [_rand()*0.05+_sin(2*3.14*j/(25+175*j/1000)) for j in range(1000)]
    #print TS
    SGfilter = Savgol(nleft=16, nright=16, order=4, deriv=1)
    #print SGfilter.filterTS(TS)
