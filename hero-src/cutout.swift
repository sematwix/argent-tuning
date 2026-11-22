// Вырезает главный объект (машину) встроенным macOS Vision и сохраняет маску PNG.
// swift cutout.swift <input> <output-mask.png>
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
guard let src = CGImageSourceCreateWithURL(input as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("cannot read image") }
let req = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([req])
guard let obs = req.results?.first else { fatalError("no foreground found") }
print("instances:", obs.allInstances.count)
let maskBuf = try obs.generateScaledMaskForImage(forInstances: obs.allInstances, from: handler)
let ci = CIImage(cvPixelBuffer: maskBuf)
let ctx = CIContext()
guard let outCG = ctx.createCGImage(ci, from: ci.extent),
      let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("cannot write") }
CGImageDestinationAddImage(dest, outCG, nil)
CGImageDestinationFinalize(dest)
print("mask:", outCG.width, "x", outCG.height)
