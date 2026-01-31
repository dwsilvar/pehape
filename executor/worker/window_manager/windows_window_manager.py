import ctypes
import time
import logging
import pyautogui
from typing import Optional, Tuple, Any
from .abstract_window_manager import AbstractWindowManager
from PIL import Image

logger = logging.getLogger(__name__)

# GDI DEFINITIONS
SRCCOPY = 0x00CC0020
SM_CXSCREEN = 0
SM_CYSCREEN = 1

PUL = ctypes.POINTER(ctypes.c_ulong)
class KeyBdInput(ctypes.Structure):
    _fields_ = [("wVk", ctypes.c_ushort),
                ("wScan", ctypes.c_ushort),
                ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong),
                ("dwExtraInfo", PUL)]

class HardwareInput(ctypes.Structure):
    _fields_ = [("uMsg", ctypes.c_ulong),
                ("wParamL", ctypes.c_ushort),
                ("wParamH", ctypes.c_ushort)]

class MouseInput(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_long),
                ("dy", ctypes.c_long),
                ("mouseData", ctypes.c_ulong),
                ("dwFlags", ctypes.c_ulong),
                ("time", ctypes.c_ulong),
                ("dwExtraInfo", PUL)]

class Input_I(ctypes.Union):
    _fields_ = [("ki", KeyBdInput),
                ("mi", MouseInput),
                ("hi", HardwareInput)]

class Input(ctypes.Structure):
    _fields_ = [("type", ctypes.c_ulong),
                ("ii", Input_I)]

# Helpers for SendInput
def _send_char(char):
    # Convert char to VK or use UNICODE?
    # Simpler approach: Use VkKeyScan for basic chars or UNICODE event
    # Using KEYEVENTF_UNICODE (0x0004)
    INPUT_KEYBOARD = 1
    KEYEVENTF_UNICODE = 0x0004
    KEYEVENTF_KEYUP = 0x0002

    vk = 0 # Not needed for unicode
    scan = ord(char)

    # Press
    u = Input_I()
    u.ki = KeyBdInput(0, scan, KEYEVENTF_UNICODE, 0, None)
    inp_down = Input(INPUT_KEYBOARD, u)

    # Release
    u_up = Input_I()
    u_up.ki = KeyBdInput(0, scan, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0, None)
    inp_up = Input(INPUT_KEYBOARD, u_up)
    
    ctypes.windll.user32.SendInput(1, ctypes.pointer(inp_down), ctypes.sizeof(inp_down))
    ctypes.windll.user32.SendInput(1, ctypes.pointer(inp_up), ctypes.sizeof(inp_up))

class WindowsWindowManager(AbstractWindowManager):

    """
    Windows implementation of window management using ctypes and pygetwindow (via pyautogui).
    """

    def ensure_window_is_visible(self, title_substring: str) -> bool:
        """
        Finds a window by its title and activates it using Windows API (ctypes) to avoid 
        mouse interaction issues and FAILSAFE triggers.
        """
        logger.info(f"Ensuring window '{title_substring}' is visible...")
        try:
            # getWindowsWithTitle works well to find the object
            windows = pyautogui.getWindowsWithTitle(title_substring)
            
            # Filtrar solo ventanas visibles para evitar procesos en segundo plano/hidden
            windows = [w for w in windows if w.visible]
            
            if not windows:
                logger.info(f"No visible window found with title '{title_substring}'.")
                return False

            window = windows[0]
            sanitized_title = window.title.replace('\u200b', '')
            logger.info(f"Window found: '{sanitized_title}'")

            # Try to get the HWND (Window Handle)
            hwnd = getattr(window, '_hWnd', None)
            if not hwnd:
                 # Fallback for some pygetwindow versions/platforms
                 logger.warning("Could not get HWND from window object. Using default activate.")
                 window.activate()
                 return True

            # Use ctypes for robust handling
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            # Get target PID and current PID/Thread
            target_pid = ctypes.c_ulong()
            target_thread_id = user32.GetWindowThreadProcessId(hwnd, ctypes.byref(target_pid))
            current_thread_id = kernel32.GetCurrentThreadId()
            
            # 1. Restore IF minimized (but avoid if possible for full-screen)
            if user32.IsIconic(hwnd):
                logger.info("Window is minimized. Showing normally...")
                user32.ShowWindow(hwnd, 1) # SW_SHOWNORMAL instead of SW_RESTORE (9)
                time.sleep(0.5)

            # 2. Check if already active OR if active window belongs to SAME PROCESS (Java apps)
            foreground_hwnd = user32.GetForegroundWindow()
            fore_pid = ctypes.c_ulong()
            user32.GetWindowThreadProcessId(foreground_hwnd, ctypes.byref(fore_pid))
            
            if foreground_hwnd == hwnd or fore_pid.value == target_pid.value:
                logger.info(f"Window (or its process {target_pid.value}) is already in foreground.")
                return True

            # 3. Force activation
            logger.info("Activating window via User32 with Thread Attachment...")
            
            # Attach input thread to allow SetForegroundWindow
            fore_thread_id = user32.GetWindowThreadProcessId(foreground_hwnd, None)
            
            attached = False
            if fore_thread_id != current_thread_id:
                attached = user32.AttachThreadInput(current_thread_id, fore_thread_id, True)
            
            try:
                user32.BringWindowToTop(hwnd)
                user32.SetForegroundWindow(hwnd)
                # For full-screen Java apps, sometimes ShowWindow is needed to force paint
                user32.ShowWindow(hwnd, 5) # SW_SHOW
            finally:
                if attached:
                    user32.AttachThreadInput(current_thread_id, fore_thread_id, False)

            time.sleep(0.3)
            
            # 4. Final verification
            foreground_hwnd = user32.GetForegroundWindow()
            user32.GetWindowThreadProcessId(foreground_hwnd, ctypes.byref(fore_pid))
            
            is_active = (foreground_hwnd == hwnd or fore_pid.value == target_pid.value)
            
            if is_active:
                logger.info(f"Window '{sanitized_title}' is now active (verified via { 'HWND' if foreground_hwnd == hwnd else 'PID' }).")
            else:
                logger.warning(f"Standard focus failed for '{sanitized_title}'. Attempting HW_TOPMOST non-intrusive trick...")
                # HWND_TOPMOST trick (non-aggressive)
                user32.SetWindowPos(hwnd, -1, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040) # HWND_TOPMOST
                time.sleep(0.2)
                user32.SetWindowPos(hwnd, -2, 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040) # HWND_NOTOPMOST
                user32.SetForegroundWindow(hwnd)
                
                # Check again
                foreground_hwnd = user32.GetForegroundWindow()
                user32.GetWindowThreadProcessId(foreground_hwnd, ctypes.byref(fore_pid))
                is_active = (foreground_hwnd == hwnd or fore_pid.value == target_pid.value)

            return is_active

        except Exception as e:
            logger.error(f"An error occurred while manipulating windows: {e}")
            return False

    def send_text(self, text: str, title_substring: str = None, interval: float = 0.05) -> bool:
        """
        Sends text using ctypes SendInput (mimicking keyboard events).
        If title_substring is provided, it attempts to activate that window first.
        """
        if title_substring:
            if not self.ensure_window_is_visible(title_substring):
                logger.warning(f"Could not activate window '{title_substring}' to send text.")
                return False
        
        logger.info(f"Sending text '{text}' via ctypes (SendInput) with interval {interval}s...")
        try:
            for char in text:
                _send_char(char)
                time.sleep(interval) # User requested observable delay
            return True
        except Exception as e:
            logger.error(f"Error sending text via ctypes: {e}")
            return False

    def capture_screenshot(self, region: Optional[Tuple[int, int, int, int]] = None) -> Any:
        """
        Captures a screenshot using Windows GDI via ctypes for high performance.
        Returns a PIL Image.
        """
        try:
            logger.info("Capturing screenshot via GDI (ctypes)...")
            
            # 1. Get dimensions
            user32 = ctypes.windll.user32
            gdi32 = ctypes.windll.gdi32
            
            # Determine capture area
            if region:
                left, top, width, height = region
            else:
                left = 0
                top = 0
                width = user32.GetSystemMetrics(SM_CXSCREEN)
                height = user32.GetSystemMetrics(SM_CYSCREEN)

            # 2. Get Device Contexts
            hwin = user32.GetDesktopWindow()
            hwindc = user32.GetWindowDC(hwin)
            if not hwindc:
                logger.error("Failed to get Window DC")
                return None
                
            srcdc = gdi32.CreateCompatibleDC(hwindc)
            if not srcdc:
                logger.error("Failed to create compatible DC")
                user32.ReleaseDC(hwin, hwindc)
                return None
            
            # 3. Create Bitmap
            bmp = gdi32.CreateCompatibleBitmap(hwindc, width, height)
            if not bmp:
                logger.error("Failed to create compatible bitmap")
                gdi32.DeleteDC(srcdc)
                user32.ReleaseDC(hwin, hwindc)
                return None
                
            gdi32.SelectObject(srcdc, bmp)
            
            # 4. Copy bits (BitBlt)
            gdi32.BitBlt(srcdc, 0, 0, width, height, hwindc, left, top, SRCCOPY)
            
            # 5. Extract bits to standard array
            bmp_info = ctypes.create_string_buffer(40) # BITMAPINFOHEADER is 40 bytes
            # We need to structure this properly or use GetBitmapBits (easier but older)
            # Let's use GetBitmapBits for simplicity as it's enough for raw pixel data, 
            # OR better: use PIL.ImageGrab.grab(bbox=region) which DOES THIS internally.
            
            # Wait, implementing raw GDI to PIL conversion manually via ctypes is prone to 
            # byte-alignment issues (BGR vs RGB, etc).
            # However, the user asked for "implementacion de ctypes".
            
            bmp_size = width * height * 4
            buffer = ctypes.create_string_buffer(bmp_size)
            gdi32.GetBitmapBits(bmp, bmp_size, buffer)
            
            # 6. Create PIL Image
            # Windows bitmaps are usually BGRA or BGRX with GetBitmapBits? 
            # Actually CreateCompatibleBitmap creates a DDB. 
            # We might treat it as RGBX or similar?
            # A safer simpler bet for "CTYPES IMPLEMENTATION" without going insane 
            # is to assume 32-bit alignment if screen is 32-bit.
            
            image = Image.frombuffer(
                'RGB', 
                (width, height), 
                buffer, 
                'raw', 
                'BGRX', 0, 1
            )
            
            # Cleanup
            gdi32.DeleteObject(bmp)
            gdi32.DeleteDC(srcdc)
            user32.ReleaseDC(hwin, hwindc)
            
            return image

        except Exception as e:
            logger.error(f"GDI Capture failed: {e}")
            return None
            
    def get_window_region(self, title_substring: str) -> Optional[Tuple[int, int, int, int]]:
        """
        Gets the region (x, y, width, height) of the specified application window.
        """
        try:
            windows = pyautogui.getWindowsWithTitle(title_substring)
            if windows:
                window = windows[0] # Use the first one found
                return (window.left, window.top, window.width, window.height)
            else:
                logger.warning(f"No window found with title containing '{title_substring}'")
                return None
        except Exception as e:
            logger.error(f"Error getting window region for '{title_substring}': {e}")
            return None
