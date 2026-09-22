/*=============================================================================
  HRM PORTAL - ALLOCATE LEAVE BALANCES
  Run last. Gives every active employee their yearly quota for the current
  and next calendar year. Safe to re-run: existing rows are left untouched.
=============================================================================*/

USE HRM;
GO

DECLARE @YEAR      INT = YEAR(GETDATE());
DECLARE @NEXT_YEAR INT = YEAR(GETDATE()) + 1;

DECLARE @USER_ID INT;

DECLARE USER_CURSOR CURSOR LOCAL FAST_FORWARD FOR
    SELECT ID FROM dbo.USERS WHERE IS_ACTIVE = 1;

OPEN USER_CURSOR;
FETCH NEXT FROM USER_CURSOR INTO @USER_ID;

WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC dbo.SP_ALLOCATE_EMPLOYEE_LEAVE
        @USER_ID    = @USER_ID,
        @YEAR       = @YEAR,
        @CREATED_BY = 1;

    EXEC dbo.SP_ALLOCATE_EMPLOYEE_LEAVE
        @USER_ID    = @USER_ID,
        @YEAR       = @NEXT_YEAR,
        @CREATED_BY = 1;

    FETCH NEXT FROM USER_CURSOR INTO @USER_ID;
END

CLOSE USER_CURSOR;
DEALLOCATE USER_CURSOR;
GO

SELECT  U.USERNAME,
        LT.NAME AS LEAVE_TYPE,
        B.[YEAR],
        B.ENTITLEMENT,
        B.USED
FROM    dbo.EMPLOYEE_LEAVE_BALANCE B
INNER JOIN dbo.USERS       U  ON U.ID  = B.USER_ID
INNER JOIN dbo.LEAVE_TYPES LT ON LT.ID = B.LEAVE_TYPE_ID
WHERE   B.[YEAR] = YEAR(GETDATE())
ORDER BY U.USERNAME, LT.DISPLAY_ORDER;
GO

PRINT 'HRM leave balances allocated.';
GO
