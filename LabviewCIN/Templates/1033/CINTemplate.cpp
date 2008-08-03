// [!output PROJECT_NAME].cpp
#include "StdAfx.h"
#include "[!output PROJECT_NAME].h"

CIN MgErr CINProperties(int32 prop, void *data)
{
	switch (prop) {
	case kCINIsReentrant:
		*(Bool32 *)data = TRUE;
		return noErr;
	}

	return mgNotSupported;
}
