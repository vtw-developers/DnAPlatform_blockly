from fastapi import APIRouter, HTTPException
import subprocess
import os
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()  # prefix는 main.py에서 설정

class DeployRequest(BaseModel):
    port: int
    code: str
    deployType: str = 'python'  # 기본값은 'python', 'graalvm'도 가능

def is_jpype_code(code: str) -> bool:
    """코드에 jpype 관련 내용이 포함되어 있는지 확인"""
    jpype_indicators = [
        "import jpype",
        "from jpype",
        "jpype.startJVM",
        "JClass",
        "JPackage"
    ]
    return any(indicator in code for indicator in jpype_indicators)

@router.post("/deploy")
async def deploy_application(request: DeployRequest):
    try:
        logger.info(f"Starting deployment process for port {request.port}")
        
        # 배포 타입에 따라 스크립트 선택
        if request.deployType == 'graalvm':
            deploy_script = os.path.join(os.path.dirname(__file__), '..', 'deploy', 'deploy_graalvm.sh')
            logger.info("Using GraalVM deployment script")
        else:
            # jpype 사용 여부에 따라 스크립트 선택
            if is_jpype_code(request.code):
                deploy_script = os.path.join(os.path.dirname(__file__), '..', 'deploy', 'deploy_jpype.sh')
                logger.info("Using JPype deployment script")
            else:
                deploy_script = os.path.join(os.path.dirname(__file__), '..', 'deploy', 'deploy_graalpy.sh')
                logger.info("Using Python deployment script")
        
        # 스크립트에 실행 권한 부여
        os.chmod(deploy_script, 0o755)
        
        # 스크립트 실행
        process = subprocess.Popen(
            [deploy_script, str(request.port), request.code],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=os.path.dirname(deploy_script)  # 스크립트가 있는 디렉토리에서 실행
        )
        
        # 실시간으로 로그 수집
        logs = []
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                log_line = line.strip()
                logger.info(log_line)
                logs.append(log_line)
        
        # 프로세스 종료 코드 확인
        return_code = process.wait()
        
        if return_code != 0:
            error_message = "배포 중 오류가 발생했습니다."
            logger.error(f"{error_message} (return code: {return_code})")
            raise HTTPException(
                status_code=500,
                detail={
                    "message": error_message,
                    "logs": logs,
                    "return_code": return_code
                }
            )
            
        logger.info("Deployment successful")
        return {
            "status": "success",
            "message": "애플리케이션이 성공적으로 배포되었습니다.",
            "logs": logs
        }
        
    except subprocess.CalledProcessError as e:
        logger.error(f"Script execution failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"스크립트 실행 실패: {e}",
                "logs": logs if 'logs' in locals() else []
            }
        )
    except Exception as e:
        logger.error(f"Deployment failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"배포 실패: {str(e)}",
                "logs": logs if 'logs' in locals() else []
            }
        ) 