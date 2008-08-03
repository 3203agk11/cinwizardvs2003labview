// [!output PROJECT_NAME].h

#include <stdio.h>
#include <string.h>

#ifdef _DEBUG
#define MyDbgPrintf DbgPrintf
#else
static inline int MyDbgPrintf(const char *fmt, ...)
{
	return 0;
}
#endif

inline void DumpOut(const void *ptr, int numbytes)
{
	const unsigned char *cptr = reinterpret_cast<const unsigned char*>(ptr);
	char Buffer[100]= "";

	for(int i=0; i<numbytes; i++, cptr++) {
		if (i%16==0) {
			MyDbgPrintf("%s", Buffer);
			Buffer[0] = '\0';
			sprintf(Buffer+strlen(Buffer), "%04x ", i);
		}

		sprintf(Buffer+strlen(Buffer), "%02x ", *cptr);
	}	

	MyDbgPrintf("%s", Buffer);
}

#pragma once