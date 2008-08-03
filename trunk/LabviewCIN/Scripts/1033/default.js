
function OnFinish(selProj, selObj)
{
	try
	{
		// Determining whether CINTOOLSDIR exist at all
		var fso, tfolder, tfile, tfilestream, CINTOOLSDIR, TemporaryFolder = 2, WindowsFolder = 0, ForReading=1, TristateFalse=0;
		var tstring ="";
		wizard.DTE.ExecuteCommand("Tools.Shell", "cmd /A/C set CINTOOLSDIR >%TMP%\\1.txt");
		fso = new ActiveXObject("Scripting.FileSystemObject");
		tfolder = fso.GetSpecialFolder(TemporaryFolder);

		do {
		} while(!fso.FileExists(tfolder+"\\1.txt"));

		tfile =fso.GetFile(tfolder+"\\1.txt");
		if(tfile.Size==0) {
			// i.e. no CINTOOLSDIR defined
			CINTOOLSDIR = wizard.GetDirectoryViaBrowseDlg("Select directory with Labview CIN Tools", fso.GetSpecialFolder(WindowsFolder));
			if(wizard.YesNoAlert("Do you want to create CINTOOLSDIR variable accordingly?\n(Do not forget to restart VS afterwards)")) {
				// Create .reg file
				// REGEDIT4
				// [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\Session Manager\Environment]
				// "CINTOOLSDIR"="D:\\Program Files\\National Instruments\\LabVIEW 6.1\\cintools"
				tfilestream = fso.CreateTextFile(tfolder+"\\1.reg", true);
				tfilestream.WriteLine("REGEDIT4");
				tfilestream.WriteLine("[HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment]");
				tstring = '"CINTOOLSDIR"="'+ CINTOOLSDIR +'"';
				re = /\\/g;             //Create regular expression pattern.
				tstring1 = tstring.replace(re, '\\\\');
				tfilestream.WriteLine(tstring1);
				tfilestream.Close();
				//run regedit
				wizard.DTE.ExecuteCommand("Tools.Shell", "regedit /S " + tfolder+ "\\1.reg" );

				//run cmd to have it in current process
				//wizard.DTE.ExecuteCommand("Tools.Shell", "cmd /C set CINTOOLSDIR="+CINTOOLSDIR);
				fso.DeleteFile(tfolder+"\\1.reg");
			}
		} else {
			tfilestream = fso.OpenTextFile(tfolder+"\\1.txt", ForReading, TristateFalse);
			CINTOOLSDIR = tfilestream.ReadLine();
			tfilestream.Close();
			CINTOOLSDIR = CINTOOLSDIR.substr(CINTOOLSDIR.indexOf("=")+1);
		}
		
		fso.DeleteFile(tfolder+"\\1.txt");
		//wizard.YesNoAlert(CINTOOLSDIR);
		
		var strProjectPath = wizard.FindSymbol('PROJECT_PATH');
		var strProjectName = wizard.FindSymbol('PROJECT_NAME');
		
		selProj = CreateCustomProject(strProjectName, strProjectPath);
		SetupFilters(selProj);
		AddFilters(selProj);
		AddCommonConfig(selProj, strProjectName);
		AddConfig(selProj, strProjectName, CINTOOLSDIR);

		var InfFile = CreateCustomInfFile();
		AddFilesToCustomProj(selProj, strProjectName, strProjectPath, InfFile);
		//SetCommonPchSettings(selProj);	
		InfFile.Delete();
		
		// Find the .c file specified, and process it in the appropriate way
		var strCFile = wizard.FindSymbol('SOURCE_FILE');
		file = selProj.Object.AddFile(strCFile);
	
		// Find appropriate codemodel
        var oSourceProjectItem = selProj.Object.Files(strCFile).Object;
        var oSourceCodeModel = oSourceProjectItem.FileCodeModel;
        var oTargetProjectHItem = selProj.Object.Files(strProjectName+".h").Object;
        var oTargetCodeHModel = oTargetProjectHItem.FileCodeModel;
        var oTargetProjectCppItem = selProj.Object.Files(strProjectName+".cpp").Object;
        var oTargetCodeCppModel = oTargetProjectCppItem.FileCodeModel;
        
        oSourceProjectItem.Open(vsViewKindCode);
        oTargetProjectCppItem.Open(vsViewKindCode);
        //oTargetProjectHItem.Open(vsViewKindCode);
        
        oTargetCodeCppModel.StartTransaction("Transform CIN file");
        
        try {
			// Extract all the required source information
			//tfilestream = fso.CreateTextFile(tfolder+"\\3.txt", true);
			
			Cnt = oSourceCodeModel.CodeElements.Count;
			
			if(oSourceCodeModel.Typedefs.Count != 0) {
				// Transfer typedefs
				oEndPoint = oSourceCodeModel.CodeElements.Item(Cnt-1).EndPoint;
				oStartPoint = oSourceCodeModel.CodeElements.Item(2).StartPoint;
				strTypedefText = oStartPoint.GetText(oEndPoint);
				//text= strTypedefText;
				//tfilestream.Write(text);
				//tfilestream.WriteLine("\n**********************************************************************************");
			} else
				strTypedefText="";

			// Transfer prototype
			oEndPoint = oSourceCodeModel.CodeElements.Item(Cnt).StartPoint;
			oStartPoint = oSourceCodeModel.CodeElements.Item(Cnt-1).EndPoint;
			text = oStartPoint.GetText(oEndPoint);
			//tfilestream.Write(text);
			//tfilestream.WriteLine("\n**********************************************************************************");
			
			tStartPoint = oTargetCodeCppModel.CodeElements.Item(3).StartPoint;
			tStartPoint.Insert('\nextern "C" {\n'+strTypedefText+text +'\n}\n\n');
						
			// Transfer CINRun Body
			oEndPoint = oSourceCodeModel.CodeElements.Item(Cnt).EndPoint;
			oStartPoint = oSourceCodeModel.CodeElements.Item(Cnt).StartPoint;
			text = oStartPoint.GetText(oEndPoint);
			//tfilestream.Write(text);
			//tfilestream.WriteLine("\n**********************************************************************************");
			
			Cnt = oTargetCodeCppModel.CodeElements.Count;
			tStartPoint = oTargetCodeCppModel.CodeElements.Item(Cnt).EndPoint;
			tStartPoint.EndOfDocument();
			tStartPoint.Insert('\n' + text);
										
			//tfilestream.Close();
		} catch (e) {
			oTargetCodeCppModel.AbortTransaction();
			throw (e);
		}
        oSourceProjectItem.Remove();
        oTargetCodeCppModel.CommitTransaction();
        selProj.Object.Save();
	}
	catch(e)
	{
		if (e.description.length != 0)
			SetErrorInfo(e);
		return e.number
	}
}

function CreateCustomProject(strProjectName, strProjectPath)
{
	try
	{
		var strProjTemplatePath = wizard.FindSymbol('PROJECT_TEMPLATE_PATH');
		var strProjTemplate = '';
		strProjTemplate = strProjTemplatePath + '\\default.vcproj';

		var Solution = dte.Solution;
		var strSolutionName = "";
		if (wizard.FindSymbol("CLOSE_SOLUTION"))
		{
			Solution.Close();
			strSolutionName = wizard.FindSymbol("VS_SOLUTION_NAME");
			if (strSolutionName.length)
			{
				var strSolutionPath = strProjectPath.substr(0, strProjectPath.length - strProjectName.length);
				Solution.Create(strSolutionPath, strSolutionName);
			}
		}

		var strProjectNameWithExt = '';
		strProjectNameWithExt = strProjectName + '.vcproj';

		var oTarget = wizard.FindSymbol("TARGET");
		var prj;
		if (wizard.FindSymbol("WIZARD_TYPE") == vsWizardAddSubProject)  // vsWizardAddSubProject
		{
			var prjItem = oTarget.AddFromTemplate(strProjTemplate, strProjectNameWithExt);
			prj = prjItem.SubProject;
		}
		else
		{
			prj = oTarget.AddFromTemplate(strProjTemplate, strProjectPath, strProjectNameWithExt);
		}
		return prj;
	}
	catch(e)
	{
		throw e;
	}
}

function AddFilters(proj)
{
	try
	{
		// Add the folder for libraries
		var strSrcFilter = wizard.FindSymbol('SOURCE_FILTER');
		var group = proj.Object.AddFilter("Libraries");
		group.Filter = "lib;obj";
	}
	catch(e)
	{
		throw e;
	}
}

function AddConfig(proj, strProjectName, CINTOOLSDIR)
{
	try
	{
		var config = proj.Object.Configurations('Debug');
		
		var Platform1 = config.Platform;
		var strCTDIR = CINTOOLSDIR+"\\"; //Platform1.Evaluate('$(CINTOOLSDIR)\\');
		
		// Add appropriate Labview files to the project
		//wizard.YesNoAlert(strCTDIR+'cin.obj');
		proj.Object.AddFile(strCTDIR+'cin.obj');
		proj.object.AddFile(strCTDIR + "labview.lib");
		proj.object.AddFile(strCTDIR + "lvsb.lib");
		proj.object.AddFile(strCTDIR + "lvsbmain.def");
	
		// Set 'Debug' configuration params
		config.CharacterSet = charSetMBCS;
		
		config.IntermediateDirectory = 'Debug';
		config.OutputDirectory = 'Debug';
		config.ConfigurationType = typeDynamicLibrary;

		var CLTool = config.Tools('VCCLCompilerTool');
		// TODO: Add compiler settings
		CLTool.UsePrecompiledHeader = pchGenerateAuto;
		CLTool.RuntimeLibrary = rtMultiThreadedDLL;
		var oldDeps = CLTool.AdditionalIncludeDirectories;
		CLTool.AdditionalIncludeDirectories = oldDeps + "$(CINTOOLSDIR)";
		CLTool.StructMemberAlignment=1;
		CLTool.WarningLevel = warningLevel_4;
		
		var strDefines = GetPlatformDefine(config);
		// Adding new defines
		strDefines += "_DEBUG";
		strDefines += ";_WINDOWS;_USRDLL;";
		//var strExports = wizard.FindSymbol("UPPER_CASE_PROJECT_NAME") + "_EXPORTS";
		//strDefines += strExports;
		CLTool.PreprocessorDefinitions = strDefines;

		var LinkTool = config.Tools('VCLinkerTool');
		// Linker settings
		LinkTool.ProgramDatabaseFile = "$(OutDir)/" + strProjectName + ".pdb";
		LinkTool.GenerateDebugInformation = true;
		LinkTool.LinkIncremental = linkIncrementalYes;

		LinkTool.SubSystem = subSystemWindows;
		LinkTool.ImportLibrary = "$(OutDir)/" + strProjectName + ".lib";
		LinkTool.OutputFile = "$(OutDir)/" + strProjectName + ".dll";
		LinkTool.ModuleDefinitionFile = '"$(CINTOOLSDIR)\\lvsbmain.def"';
		
		var CustomBuildStepTool = config.Tools('VCCustomBuildTool');
		// Custom build step defined
		CustomBuildStepTool.CommandLine = '"$(CINTOOLSDIR)\\lvsbutil" $(TargetName) -d "$(ProjectDir)$(OutDir)"';
		CustomBuildStepTool.Description = "Creating CIN";
		CustomBuildStepTool.Outputs = "$(OutDir)$(TargetName).lsb";

		// *****************RELEASE**********************************
		config = proj.Object.Configurations('Release');
		config.IntermediateDirectory = 'Release';
		config.OutputDirectory = 'Release';

		var CLTool = config.Tools('VCCLCompilerTool');
		// Set 'Release' configuration params
		config.CharacterSet = charSetMBCS;
		config.ConfigurationType = typeDynamicLibrary;
		

		// TODO: Add compiler settings
		CLTool.GlobalOptimizations = true;
		CLTool.UsePrecompiledHeader = pchNone;
		CLTool.RuntimeLibrary = rtMultiThreadedDLL;
		var oldDeps = CLTool.AdditionalIncludeDirectories;
		CLTool.AdditionalIncludeDirectories = oldDeps + "$(CINTOOLSDIR)";
		CLTool.StructMemberAlignment=1;
		CLTool.WarningLevel = warningLevel_0;
		CLTool.Optimization = optimizeOption.optimizeMaxSpeed;
		CLTool.OptimizeForProcessor = ProcessorOptimizeOption.procOptimizePentiumFourAndAbove;
		CLTool.WholeProgramOptimization = true;
		
		var strDefines = GetPlatformDefine(config);
		// Adding new defines
		strDefines += "NDEBUG";
		strDefines += ";_WINDOWS;_USRDLL;";
		//var strExports = wizard.FindSymbol("UPPER_CASE_PROJECT_NAME") + "_EXPORTS";
		//strDefines += strExports;
		CLTool.PreprocessorDefinitions = strDefines;

		var LinkTool = config.Tools('VCLinkerTool');
		// Linker settings
		LinkTool.ProgramDatabaseFile = "$(OutDir)/" + strProjectName + ".pdb";
		LinkTool.GenerateDebugInformation = false;
		LinkTool.LinkIncremental = linkIncrementalNo;
		LinkTool.AdditionalOptions = LinkTool.AdditionalOptions+"/LTCG";


		LinkTool.SubSystem = subSystemWindows;
		LinkTool.ImportLibrary = "$(OutDir)/" + strProjectName + ".lib";
		LinkTool.OutputFile = "$(OutDir)/" + strProjectName + ".dll";
		LinkTool.ModuleDefinitionFile = '"$(CINTOOLSDIR)\\lvsbmain.def"';
		
		var CustomBuildStepTool = config.Tools('VCCustomBuildTool');
		// Custom build step defined
		CustomBuildStepTool.CommandLine = '"$(CINTOOLSDIR)\\lvsbutil" $(TargetName) -d "$(ProjectDir)$(OutDir)"';
		CustomBuildStepTool.Description = "Creating CIN";
		CustomBuildStepTool.Outputs = "$(OutDir)$(TargetName).lsb";
	}
	catch(e)
	{
		throw e;
	}
}

function DelFile(fso, strWizTempFile)
{
	try
	{
		if (fso.FileExists(strWizTempFile))
		{
			var tmpFile = fso.GetFile(strWizTempFile);
			tmpFile.Delete();
		}
	}
	catch(e)
	{
		throw e;
	}
}

function CreateCustomInfFile()
{
	try
	{
		var fso, TemplatesFolder, TemplateFiles, strTemplate;
		fso = new ActiveXObject('Scripting.FileSystemObject');

		var TemporaryFolder = 2;
		var tfolder = fso.GetSpecialFolder(TemporaryFolder);
		var strTempFolder = tfolder.Drive + '\\' + tfolder.Name;

		var strWizTempFile = strTempFolder + "\\" + fso.GetTempName();

		var strTemplatePath = wizard.FindSymbol('TEMPLATES_PATH');
		var strInfFile = strTemplatePath + '\\Templates.inf';
		wizard.RenderTemplate(strInfFile, strWizTempFile);

		var WizTempFile = fso.GetFile(strWizTempFile);
		return WizTempFile;
	}
	catch(e)
	{
		throw e;
	}
}

function GetTargetName(strName, strProjectName)
{
	try
	{
		// TODO: set the name of the rendered file based on the template filename
		var strTarget = strName;

		if (strName == 'readme.txt')
			strTarget = 'ReadMe.txt';

		if (strName == 'sample.txt')
			strTarget = 'Sample.txt';
			
		if(strName == 'CINTemplate.cpp')
			strTarget = strProjectName + '.cpp';

		if(strName == 'CINHeaderTemplate.h')
			strTarget = strProjectName + '.h';

		return strTarget; 
	}
	catch(e)
	{
		throw e;
	}
}

function AddFilesToCustomProj(proj, strProjectName, strProjectPath, InfFile)
{
	try
	{
		var projItems = proj.ProjectItems

		var strTemplatePath = wizard.FindSymbol('TEMPLATES_PATH');

		var strTpl = '';
		var strName = '';

		var strTextStream = InfFile.OpenAsTextStream(1, -2);
		while (!strTextStream.AtEndOfStream)
		{
			strTpl = strTextStream.ReadLine();
			if (strTpl != '')
			{
				strName = strTpl;
				var strTarget = GetTargetName(strName, strProjectName);
				var strTemplate = strTemplatePath + '\\' + strTpl;
				var strFile = strProjectPath + '\\' + strTarget;

				var bCopyOnly = false;  //"true" will only copy the file from strTemplate to strTarget without rendering/adding to the project
				var strExt = strName.substr(strName.lastIndexOf("."));
				if(strExt==".bmp" || strExt==".ico" || strExt==".gif" || strExt==".rtf" || strExt==".css")
					bCopyOnly = true;
				wizard.RenderTemplate(strTemplate, strFile, bCopyOnly);
				proj.Object.AddFile(strFile);
			}
		}
		strTextStream.Close();
	}
	catch(e)
	{
		throw e;
	}
}

